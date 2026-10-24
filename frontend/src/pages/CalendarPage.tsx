import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { useAppStore } from '@/hooks/useAppStore'
import { createObligation, updateObligation } from '@/api/companies'
import { buildPaymentSchedule } from '@/utils/finance'
import { formatMoney, formatDate } from '@/utils/format'
import type { Obligation } from '@/types'

type ViewMode = 'day' | 'week' | 'month'

export function CalendarPage() {
  const { obligations, financials, goal, companyId } = useAppStore()
  const qc = useQueryClient()
  const [view, setView] = useState<ViewMode>('month')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(50_000)
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [type, setType] = useState('supplier')
  const [error, setError] = useState<string | null>(null)

  const creditEvents = useMemo(() => {
    if (!goal || !companyId) return [] as Obligation[]
    const schedule = buildPaymentSchedule({
      amount: goal.requiredAmount,
      termMonths: Math.min(goal.termMonths, 6),
      annualRate: 19.5,
      scheduleType: 'annuity',
      startDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
    })
    return schedule.rows.map((r) => ({
      id: `credit_${r.month}`,
      companyId,
      type: 'loan',
      title: `Кредитный платёж #${r.month}`,
      amount: r.payment,
      dueDate: r.date,
      recurring: true,
      status: 'planned' as const,
      currency: 'RUB' as const,
    }))
  }, [goal, companyId])

  const all = [...obligations, ...creditEvents].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const filtered = all.filter((o) => {
    const d = dayjs(o.dueDate)
    const now = dayjs()
    if (view === 'day') return d.isSame(now, 'day')
    if (view === 'week') return d.isAfter(now.subtract(1, 'day')) && d.isBefore(now.add(7, 'day'))
    return d.isSame(now, 'month') || d.isAfter(now)
  })

  const monthOutflow = filtered.reduce((a, o) => a + o.amount, 0)
  const projectedBalance = financials.cashBalance - monthOutflow

  async function addEvent() {
    if (!title || !companyId) return
    setError(null)
    try {
      await createObligation({
        companyId,
        type,
        title,
        amount,
        dueDate,
        recurring: false,
        status: 'planned',
      })
      await qc.invalidateQueries({ queryKey: ['obligations', companyId] })
      setTitle('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  async function markPaid(id: string) {
    if (!companyId) return
    try {
      await updateObligation(id, { status: 'paid' })
      await qc.invalidateQueries({ queryKey: ['obligations', companyId] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  return (
    <Box>
      <PageHeader
        title="Финансовый календарь"
        subtitle="Обязательства + импорт графика кредита."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="day">День</ToggleButton>
          <ToggleButton value="week">Неделя</ToggleButton>
          <ToggleButton value="month">Месяц</ToggleButton>
        </ToggleButtonGroup>
        <Chip
          label={`Прогноз остатка: ${formatMoney(projectedBalance)}`}
          color={projectedBalance < 0 ? 'error' : 'default'}
        />
        {projectedBalance < 0 && <Chip color="warning" label="Риск кассового разрыва" />}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Typography variant="subtitle2" gutterBottom>
          Новое событие
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField size="small" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <TextField
            select
            size="small"
            label="Тип"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            {['rent', 'salary', 'tax', 'supplier', 'insurance', 'investment', 'inflow', 'other'].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Сумма"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            sx={{ minWidth: 120 }}
          />
          <TextField
            size="small"
            type="date"
            label="Дата"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={() => void addEvent()}>
            Добавить
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Дата</TableCell>
              <TableCell>Событие</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell align="right">Сумма</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell>{formatDate(o.dueDate)}</TableCell>
                <TableCell>
                  {o.title}
                  {o.id.startsWith('credit_') && (
                    <Chip size="small" label="из графика кредита" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell align="right">{formatMoney(o.amount)}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell align="right">
                  {!o.id.startsWith('credit_') && o.status !== 'paid' && (
                    <Button size="small" onClick={() => void markPaid(o.id)}>
                      Оплачено
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
