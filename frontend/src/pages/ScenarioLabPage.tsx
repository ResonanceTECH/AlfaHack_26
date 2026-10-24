import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import { Disclaimer } from '@/components/common/Disclaimer'
import { useAppStore } from '@/hooks/useAppStore'
import { saveScenario as persistScenario } from '@/api/credit'
import { runCreditScenario } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import type { CreditScenarioParams, ScheduleType } from '@/types'

export function ScenarioLabPage() {
  const { financials, goal, scenarios, companyId } = useAppStore()
  const qc = useQueryClient()
  const [name, setName] = useState('Базовый')
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<CreditScenarioParams>({
    amount: goal?.requiredAmount ?? 0,
    termMonths: 36,
    annualRate: 20,
    scheduleType: 'annuity',
    disbursementDate: new Date().toISOString().slice(0, 10),
    repaymentStartDate: new Date().toISOString().slice(0, 10),
    revenueChangePct: 0,
    expenseChangePct: 0,
    oneTimeInvestment: 0,
    ownFunds: 0,
    seasonalSwingPct: 8,
    baseMonthlyRevenue: financials.avgMonthlyRevenue,
    baseMonthlyExpenses: financials.operatingExpenses,
  })

  useEffect(() => {
    setParams((p) => ({
      ...p,
      amount: goal?.requiredAmount ?? p.amount,
      baseMonthlyRevenue: financials.avgMonthlyRevenue,
      baseMonthlyExpenses: financials.operatingExpenses,
    }))
  }, [goal, financials])

  const result = useMemo(() => runCreditScenario(name, params), [name, params])

  function patch<K extends keyof CreditScenarioParams>(key: K, value: CreditScenarioParams[K]) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  async function onSave() {
    if (!companyId) {
      setError('Нет компании')
      return
    }
    setError(null)
    try {
      await persistScenario({
        companyId,
        name,
        params,
        persist: true,
      })
      await qc.invalidateQueries({ queryKey: ['scenarios', companyId] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  return (
    <Box>
      <PageHeader
        title="Credit Scenario Lab"
        subtitle="Стресс-тест бизнеса: платежи накладываются на прогноз cash flow."
      />
      <Disclaimer dense />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Stack spacing={2}>
              <TextField label="Название сценария" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField
                label="Сумма финансирования"
                type="number"
                value={params.amount}
                onChange={(e) => patch('amount', Number(e.target.value))}
                fullWidth
              />
              <Typography variant="caption">Срок: {params.termMonths} мес.</Typography>
              <Slider
                min={6}
                max={84}
                value={params.termMonths}
                onChange={(_, v) => patch('termMonths', v as number)}
              />
              <Typography variant="caption">Ставка: {params.annualRate}%</Typography>
              <Slider
                min={10}
                max={30}
                step={0.5}
                value={params.annualRate}
                onChange={(_, v) => patch('annualRate', v as number)}
              />
              <Typography variant="caption">Снижение/рост выручки: {params.revenueChangePct}%</Typography>
              <Slider
                min={-50}
                max={30}
                value={params.revenueChangePct}
                onChange={(_, v) => patch('revenueChangePct', v as number)}
              />
              <Typography variant="caption">Изменение расходов: {params.expenseChangePct}%</Typography>
              <Slider
                min={-20}
                max={40}
                value={params.expenseChangePct}
                onChange={(_, v) => patch('expenseChangePct', v as number)}
              />
              <TextField
                select
                label="График"
                value={params.scheduleType}
                onChange={(e) => patch('scheduleType', e.target.value as ScheduleType)}
                fullWidth
              >
                <MenuItem value="annuity">Аннуитет</MenuItem>
                <MenuItem value="differentiated">Дифференцированный</MenuItem>
              </TextField>
              <TextField
                label="Разовые инвестиции"
                type="number"
                value={params.oneTimeInvestment}
                onChange={(e) => patch('oneTimeInvestment', Number(e.target.value))}
                fullWidth
              />
              <Button variant="contained" onClick={() => void onSave()}>
                Сохранить сценарий
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setName('Стресс −20% выручки')
                  patch('revenueChangePct', -20)
                }}
              >
                Стресс: −20% выручки
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Платёж в месяц" value={formatMoney(result.monthlyPayment)} accent />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Денежный поток после платежа" value={formatMoney(result.cashFlowAfterPayment)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Min остаток" value={formatMoney(result.minBalance)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Месяцев дефицита" value={String(result.deficitMonths.length)} />
            </Grid>
          </Grid>

          <Alert severity={result.cashFlowAfterPayment >= 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {result.explanation}
          </Alert>

          <Paper sx={{ p: 2, height: 320, mb: 2 }} elevation={1}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="balance" name="Остаток" stroke="#EF3124" dot={false} />
                <Line type="monotone" dataKey="netFlow" name="Net flow" stroke="#0B1F35" dot={false} />
                <Line type="monotone" dataKey="payment" name="Платёж" stroke="#D97706" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          {scenarios.length > 0 && (
            <Paper sx={{ p: 2 }} elevation={1}>
              <Typography variant="subtitle2" gutterBottom>
                Сохранённые сценарии
              </Typography>
              <Stack spacing={1}>
                {scenarios.map((s) => (
                  <Stack key={s.id} direction="row" justifyContent="space-between">
                    <Typography variant="body2">
                      {s.name}: платёж {formatMoney(s.monthlyPayment)}, CF{' '}
                      {formatMoney(s.cashFlowAfterPayment)}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        setName(s.name)
                        setParams(s.params)
                      }}
                    >
                      Открыть
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}
