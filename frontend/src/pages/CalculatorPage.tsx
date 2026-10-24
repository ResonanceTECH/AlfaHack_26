import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { PaymentScheduleTable } from '@/features/credit/PaymentScheduleTable'
import { Disclaimer } from '@/components/common/Disclaimer'
import { useAppStore } from '@/hooks/useAppStore'
import { buildPaymentSchedule, downloadText, exportScheduleCsv } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import type { ScheduleType } from '@/types'

export function CalculatorPage() {
  const { selectedProductId, goal, products, isLoading } = useAppStore()
  const [productId, setProductId] = useState(selectedProductId ?? '')
  const product = products.find((p) => p.id === productId) ?? products[0]

  const [amount, setAmount] = useState(goal?.requiredAmount ?? 0)
  const [term, setTerm] = useState(goal?.termMonths ?? 12)
  const [rate, setRate] = useState(0)
  const [scheduleType, setScheduleType] = useState<ScheduleType>('annuity')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (product) setRate((product.rateMin + product.rateMax) / 2)
  }, [product])

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id)
  }, [products, productId])

  const feePercent = product?.fees.find((f) => f.type === 'percent')?.value ?? 0
  const feeFixed = product?.fees.find((f) => f.type === 'fixed')?.value ?? 0

  const result = useMemo(
    () =>
      product
        ? buildPaymentSchedule({
            amount,
            termMonths: term,
            annualRate: rate,
            scheduleType,
            startDate,
            feesPercent: feePercent,
            feesFixed: feeFixed,
          })
        : null,
    [amount, term, rate, scheduleType, startDate, feePercent, feeFixed, product],
  )

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!product || !result) {
    return (
      <Box>
        <PageHeader title="Кредитный калькулятор" />
        <Alert severity="info">Каталог продуктов пуст — дождитесь ответа API.</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Кредитный калькулятор"
        subtitle="Аннуитет и дифференцированный график. Сумма погашенного ОД = сумме кредита."
        crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'Калькулятор' }]}
        actions={
          <Button
            variant="outlined"
            onClick={() => downloadText(`schedule_${productId}.csv`, exportScheduleCsv(result.rows))}
          >
            Экспорт CSV
          </Button>
        }
      />
      <Disclaimer dense />

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Stack spacing={2}>
              <TextField
                select
                label="Продукт"
                value={product.id}
                onChange={(e) => {
                  const id = e.target.value
                  setProductId(id)
                  const p = products.find((x) => x.id === id)!
                  setRate((p.rateMin + p.rateMax) / 2)
                }}
                fullWidth
              >
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Сумма"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Срок, мес."
                type="number"
                value={term}
                onChange={(e) => setTerm(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Ставка, %"
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                fullWidth
              />
              <TextField
                select
                label="График"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                fullWidth
              >
                <MenuItem value="annuity">Аннуитет</MenuItem>
                <MenuItem value="differentiated">Дифференцированный</MenuItem>
              </TextField>
              <TextField
                label="Дата первого платежа"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Платёж" value={formatMoney(result.monthlyPayment)} accent />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Всего к выплате" value={formatMoney(result.totalPayment)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Проценты" value={formatMoney(result.totalInterest)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Комиссии" value={formatMoney(result.totalFees)} />
            </Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {product.name}
          </Typography>
          <PaymentScheduleTable result={result} />
        </Grid>
      </Grid>
    </Box>
  )
}
