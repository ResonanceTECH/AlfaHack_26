import Grid from '@mui/material/Grid2'
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
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { useAppStore } from '@/hooks/useAppStore'
import { requestDocuments, updateApplicationStatus } from '@/api/applications'
import { formatMoney, formatDateTime } from '@/utils/format'
import { statusColors, statusLabels } from '@/data/labels'
import type { ApplicationStatus } from '@/types'

const managerTransitions: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ['in_review', 'docs_requested', 'rejected'],
  in_review: ['docs_requested', 'approved', 'rejected'],
  docs_requested: ['in_review', 'rejected'],
  approved: ['issued', 'rejected'],
}

export function ManagerPage() {
  const { apps, financials } = useAppStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState('')
  const [docType, setDocType] = useState('Договор с поставщиком')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(
    () => apps.filter((a) => statusFilter === 'all' || a.status === statusFilter),
    [apps, statusFilter],
  )
  const selected =
    apps.find((a) => a.id === selectedId) ?? filtered[0] ?? undefined

  async function changeStatus(next: ApplicationStatus) {
    if (!selected) return
    setError(null)
    try {
      await updateApplicationStatus(selected.id, next)
      await qc.invalidateQueries({ queryKey: ['applications'] })
      setMsg(`Статус изменён → ${statusLabels[next]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  async function askDoc() {
    if (!selected) return
    setError(null)
    try {
      await requestDocuments(selected.id, docType)
      await qc.invalidateQueries({ queryKey: ['applications'] })
      setSelectedId(selected.id)
      setMsg(`Запрошен документ: ${docType}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  return (
    <Box>
      <PageHeader
        title="Кабинет кредитного менеджера"
        subtitle="Очередь заявок, документы и допустимые переходы статусов."
      />
      {msg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock label="В очереди" value={apps.filter((a) => a.status !== 'draft').length} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock
            label="На рассмотрении"
            value={apps.filter((a) => a.status === 'in_review' || a.status === 'submitted').length}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock
            label="Запрос документов"
            value={apps.filter((a) => a.status === 'docs_requested').length}
            accent
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                select
                size="small"
                label="Статус"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">Все</MenuItem>
                {(Object.keys(statusLabels) as ApplicationStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {statusLabels[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Продукт</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow
                    key={a.id}
                    hover
                    selected={selected?.id === a.id}
                    onClick={() => setSelectedId(a.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{a.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.companyId.slice(0, 8)}…
                      </Typography>
                    </TableCell>
                    <TableCell>{formatMoney(a.amount)}</TableCell>
                    <TableCell>
                      <Chip size="small" color={statusColors[a.status]} label={statusLabels[a.status]} />
                    </TableCell>
                    <TableCell>{formatDateTime(a.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {selected ? (
            <Paper elevation={1} sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                Карточка заявки
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {selected.productName} · {formatMoney(selected.amount)} · {selected.termMonths} мес. ·
                ставка {selected.rate}%
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                Финансовое резюме (ваша сессия)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Выручка {formatMoney(financials.avgMonthlyRevenue)}/мес · расходы{' '}
                {formatMoney(financials.operatingExpenses)} · остаток{' '}
                {formatMoney(financials.cashBalance)}
              </Typography>
              {selected.aiSummary && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  AI-резюме: {selected.aiSummary}
                </Alert>
              )}

              <Typography variant="subtitle2" gutterBottom>
                Документы
              </Typography>
              {selected.documents.map((d) => (
                <Typography key={d.id} variant="body2">
                  • {d.name} ({d.status})
                </Typography>
              ))}

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Действия</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {(managerTransitions[selected.status] ?? []).map((s) => (
                    <Button key={s} size="small" variant="outlined" onClick={() => void changeStatus(s)}>
                      → {statusLabels[s]}
                    </Button>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Запросить документ"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    fullWidth
                  />
                  <Button variant="contained" onClick={() => void askDoc()}>
                    Запрос
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <Paper sx={{ p: 3 }} elevation={1}>
              <Typography color="text.secondary">Выберите заявку из очереди</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}
