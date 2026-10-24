import Grid from '@mui/material/Grid2'
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { evaluateProject } from '@/utils/finance'
import { formatMoney, formatPercent } from '@/utils/format'
import type { ProjectEvaluationInput } from '@/types'

export function RoiPage() {
  const [input, setInput] = useState<ProjectEvaluationInput>({
    initialInvestment: 3_000_000,
    ownFunds: 500_000,
    creditAmount: 2_500_000,
    additionalSales: 280_000,
    variableCosts: 120_000,
    fixedCosts: 40_000,
    taxRate: 6,
    horizonMonths: 36,
    residualValue: 400_000,
    discountRate: 15,
    creditRate: 19,
    creditTermMonths: 36,
  })

  const result = useMemo(() => evaluateProject(input), [input])

  function patch<K extends keyof ProjectEvaluationInput>(key: K, value: ProjectEvaluationInput[K]) {
    setInput((s) => ({ ...s, [key]: value }))
  }

  const fields: { key: keyof ProjectEvaluationInput; label: string }[] = [
    { key: 'initialInvestment', label: 'Первоначальные инвестиции' },
    { key: 'ownFunds', label: 'Собственные средства' },
    { key: 'creditAmount', label: 'Сумма кредита' },
    { key: 'additionalSales', label: 'Доп. продажи / мес.' },
    { key: 'variableCosts', label: 'Переменные расходы / мес.' },
    { key: 'fixedCosts', label: 'Постоянные расходы / мес.' },
    { key: 'taxRate', label: 'Налог, %' },
    { key: 'horizonMonths', label: 'Горизонт, мес.' },
    { key: 'residualValue', label: 'Остаточная стоимость' },
    { key: 'discountRate', label: 'Ставка дисконтирования, %' },
    { key: 'creditRate', label: 'Ставка кредита, %' },
    { key: 'creditTermMonths', label: 'Срок кредита, мес.' },
  ]

  return (
    <Box>
      <PageHeader
        title="Окупаемость проекта"
        subtitle="NPV, IRR, payback, ROI. Учитывается обслуживание долга."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Stack spacing={1.5}>
              {fields.map((f) => (
                <TextField
                  key={f.key}
                  label={f.label}
                  type="number"
                  size="small"
                  value={input[f.key]}
                  onChange={(e) => patch(f.key, Number(e.target.value))}
                  fullWidth
                />
              ))}
              <Button variant="outlined" onClick={() => setInput({ ...input })}>
                Пересчитать
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock
                label="Простая окупаемость"
                value={result.simplePaybackMonths != null ? `${result.simplePaybackMonths} мес.` : 'Не окупается'}
                accent
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock
                label="Дисконт. окупаемость"
                value={
                  result.discountedPaybackMonths != null
                    ? `${result.discountedPaybackMonths} мес.`
                    : 'Не окупается'
                }
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock label="NPV" value={formatMoney(result.npv)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock label="IRR" value={result.irr != null ? formatPercent(result.irr) : '—'} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock label="ROI" value={formatPercent(result.roi)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatBlock
                label="Точка безубыточности (усл.)"
                value={result.breakEvenUnits != null ? String(Math.round(result.breakEvenUnits)) : '—'}
              />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, height: 340 }} elevation={1}>
            <Typography variant="subtitle2" gutterBottom>
              Накопленный денежный поток
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={result.cashFlows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="cumulative" name="Накоплено" stroke="#EF3124" dot={false} />
                <Line type="monotone" dataKey="discounted" name="Дисконтировано" stroke="#0B1F35" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
