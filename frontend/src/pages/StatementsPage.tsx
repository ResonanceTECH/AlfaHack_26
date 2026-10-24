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
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { useAppStore } from '@/hooks/useAppStore'
import { importStatement, updateTransactionCategory } from '@/api/statements'
import { formatMoney, formatDate } from '@/utils/format'
import { categoryLabels } from '@/data/labels'
import type { StatementImportResult, TransactionCategory } from '@/types'

export function StatementsPage() {
  const { transactions, companyId } = useAppStore()
  const qc = useQueryClient()
  const [result, setResult] = useState<StatementImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  async function onFile(file: File | undefined) {
    if (!file || !companyId) {
      setError(!companyId ? 'Нет компании' : 'Выберите файл')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await importStatement(companyId, file)
      setResult(res)
      await qc.invalidateQueries({ queryKey: ['transactions', companyId] })
      await qc.invalidateQueries({ queryKey: ['financials', companyId] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка импорта')
    } finally {
      setLoading(false)
    }
  }

  async function onCategory(id: string, category: TransactionCategory) {
    if (!companyId) return
    await updateTransactionCategory(id, category)
    await qc.invalidateQueries({ queryKey: ['transactions', companyId] })
    if (result) {
      setResult({
        ...result,
        transactions: result.transactions.map((t) => (t.id === id ? { ...t, category } : t)),
      })
    }
  }

  const rows = (result?.transactions ?? transactions).filter(
    (t) => categoryFilter === 'all' || t.category === categoryFilter,
  )

  return (
    <Box>
      <PageHeader
        title="Анализ банковской выписки"
        subtitle="CSV/XLSX → нормализация, классификация, исключение внутренних переводов, KPI в профиль."
      />

      <Paper sx={{ p: 2.5, mb: 2 }} elevation={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Button variant="contained" component="label" disabled={loading || !companyId}>
            {loading ? 'Обработка…' : 'Загрузить выписку'}
            <input
              hidden
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </Button>
          <Typography variant="body2" color="text.secondary">
            Дубликаты по хэшу не создаются повторно.
          </Typography>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {result && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Поступления" value={formatMoney(result.summary.totalInflow)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Списания" value={formatMoney(result.summary.totalOutflow)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Net" value={formatMoney(result.summary.netCashFlow)} accent />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock
                label="Внутр. переводы"
                value={String(result.summary.excludedInternalTransfers)}
              />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, height: 280, mb: 2 }} elevation={1}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Bar dataKey="inflow" name="In" fill="#16A34A" />
                <Bar dataKey="outflow" name="Out" fill="#EF3124" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
        <TextField
          select
          size="small"
          label="Категория"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">Все</MenuItem>
          {(Object.keys(categoryLabels) as TransactionCategory[]).map((c) => (
            <MenuItem key={c} value={c}>
              {categoryLabels[c]}
            </MenuItem>
          ))}
        </TextField>
        <Chip label={`${rows.length} операций`} size="small" />
      </Stack>

      <Paper elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Дата</TableCell>
              <TableCell>Контрагент</TableCell>
              <TableCell>Назначение</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell align="right">Сумма</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(0, 100).map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell>{t.counterparty}</TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                    {t.purpose}
                  </Typography>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={t.category}
                    onChange={(e) => void onCategory(t.id, e.target.value as TransactionCategory)}
                    variant="standard"
                  >
                    {(Object.keys(categoryLabels) as TransactionCategory[]).map((c) => (
                      <MenuItem key={c} value={c}>
                        {categoryLabels[c]}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell align="right" sx={{ color: t.direction === 'in' ? 'success.main' : undefined }}>
                  {t.direction === 'in' ? '+' : '−'}
                  {formatMoney(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
