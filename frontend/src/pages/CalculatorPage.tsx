import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { calculateCredit, listProducts } from '@/api/credit'
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildPaymentSchedule } from '@/utils/finance'
import { saveScenarioHandoff } from '@/features/scenarios/handoff'
import type { ScheduleType } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

function money(n: number) {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

function moneyShort(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CalculatorPage() {
  const navigate = useNavigate()
  const [product, setProduct] = useState('turnover')
  const [amount, setAmount] = useState(5_000_000)
  const [term, setTerm] = useState(24)
  const [rate, setRate] = useState(17.3)
  const [scheduleType, setScheduleType] = useState<ScheduleType>('annuity')
  const [showAll, setShowAll] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const startDate = '2026-11-28'

  const catalogQ = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })
  const catalog = catalogQ.data ?? []
  const usingCatalog = catalog.length > 0
  const productId = usingCatalog && catalog.some((p) => p.id === product) ? product : undefined

  useEffect(() => {
    if (usingCatalog && !catalog.some((p) => p.id === product)) {
      setProduct(catalog[0]!.id)
    }
  }, [usingCatalog, catalog, product])

  const [debounced, setDebounced] = useState({ amount, term, rate, scheduleType, productId })
  useEffect(() => {
    const t = window.setTimeout(
      () => setDebounced({ amount, term, rate, scheduleType, productId }),
      280,
    )
    return () => window.clearTimeout(t)
  }, [amount, term, rate, scheduleType, productId])

  const calcQ = useQuery({
    queryKey: ['credit-calc', debounced],
    queryFn: () =>
      calculateCredit({
        productId: debounced.productId,
        amount: debounced.amount,
        termMonths: debounced.term,
        annualRatePercent: debounced.rate,
        repaymentType: debounced.scheduleType === 'annuity' ? 'ANNUITY' : 'DIFFERENTIATED',
        startDate,
      }),
    enabled: debounced.amount > 0 && debounced.term > 0,
    retry: false,
  })

  const result = useMemo(
    () =>
      buildPaymentSchedule({
        amount,
        termMonths: term,
        annualRate: rate,
        scheduleType,
        startDate,
      }),
    [amount, term, rate, scheduleType],
  )

  const api = calcQ.data
  const payment = api?.monthlyPayment || result.rows[0]?.payment || 0
  const totalPay = api?.totalPayments || result.totalPayment
  const overpay = api?.overpayment || result.totalInterest
  const interestShare = totalPay > 0 ? Math.round((overpay / totalPay) * 100) : 0

  const pie = [
    { name: 'Проценты', value: overpay, color: '#EF3124' },
    { name: 'Основной долг', value: amount, color: '#2B3A4A' },
  ]

  const debtLine = result.rows
    .filter((_, i) => i % Math.max(1, Math.floor(term / 8)) === 0 || i === result.rows.length - 1)
    .map((r) => ({
      m: r.month,
      debt: Math.round((r.balance / 1_000_000) * 100) / 100,
    }))

  const visibleRows = showAll ? result.rows : result.rows.slice(0, 6)

  function toApplication() {
    saveScenarioHandoff({
      amount,
      termMonths: term,
      rate,
      payment: Math.round(payment),
      source: 'calculator',
    })
    navigate('/app/applications/new')
  }

  function saveCalc() {
    setFlash('Расчёт сохранён в сценариях (демо)')
    window.setTimeout(() => setFlash(null), 2000)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/scenarios"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Калькулятор и сценарии
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Кредитный калькулятор
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 24, md: 28 },
            letterSpacing: '-0.03em',
            color: '#0B1F35',
          }}
        >
          Кредитный калькулятор
        </Typography>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={saveCalc}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Сохранить расчёт
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/compare')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Сравнить с предложением
          </Button>
        </Stack>
      </Stack>

      {flash && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {flash}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 0.95fr) minmax(0, 1.15fr)' },
          mb: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Параметры
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Продукт"
            value={product}
            onChange={(e) => {
              const id = e.target.value
              setProduct(id)
              const p = catalog.find((x) => x.id === id)
              if (p) {
                if (p.rateMin) setRate(p.rateMin)
                setAmount((a) =>
                  Math.min(p.amountMax || a, Math.max(p.amountMin || a, a)),
                )
                setTerm((t) => Math.min(p.termMax || t, Math.max(p.termMin || t, t)))
              }
            }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            {usingCatalog
              ? catalog.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))
              : [
                  <MenuItem key="turnover" value="turnover">
                    Бизнес-Оборот
                  </MenuItem>,
                  <MenuItem key="invest" value="invest">
                    Бизнес-Инвест
                  </MenuItem>,
                  <MenuItem key="overdraft" value="overdraft">
                    Овердрафт
                  </MenuItem>,
                ]}
          </TextField>

          <ParamSlider
            label="Сумма"
            valueLabel={`${moneyShort(amount)} ₽`}
            value={amount}
            min={500_000}
            max={15_000_000}
            step={100_000}
            onChange={setAmount}
          />
          <ParamSlider
            label="Срок"
            valueLabel={`${term} мес`}
            value={term}
            min={6}
            max={60}
            step={1}
            onChange={setTerm}
          />
          <ParamSlider
            label="Ставка"
            valueLabel={`${String(rate).replace('.', ',')}%`}
            value={rate}
            min={10}
            max={28}
            step={0.1}
            onChange={setRate}
          />

          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6B7D', mb: 0.5 }}>
            Тип платежа
          </Typography>
          <RadioGroup
            row
            value={scheduleType}
            onChange={(_, v) => setScheduleType(v as ScheduleType)}
            sx={{ mb: 2 }}
          >
            <FormControlLabel
              value="annuity"
              control={<Radio size="small" sx={{ '&.Mui-checked': { color: '#EF3124' } }} />}
              label={<Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Аннуитет</Typography>}
            />
            <FormControlLabel
              value="differentiated"
              control={<Radio size="small" sx={{ '&.Mui-checked': { color: '#EF3124' } }} />}
              label={<Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Дифференцированный</Typography>}
            />
          </RadioGroup>

          <Button
            fullWidth
            variant="contained"
            color="primary"
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.15,
              boxShadow: 'none',
            }}
          >
            Рассчитать
          </Button>
        </Box>

        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 0.75 }}>
              Результат
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: { xs: 28, md: 34 },
                    letterSpacing: '-0.03em',
                    color: '#0B1F35',
                    lineHeight: 1.1,
                  }}
                >
                  ≈ {moneyShort(payment)} ₽
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#7A8795', mt: 0.75 }}>
                  Всего выплат ≈ {money(totalPay)}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#7A8795' }}>
                  Переплата ≈ {money(overpay)}
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#0B1F35',
                    lineHeight: 1.4,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: 'rgba(239,49,36,0.05)',
                    border: '1px solid rgba(239,49,36,0.15)',
                  }}
                >
                  Платёж ≈ {moneyShort(payment)} ₽/мес при {term} мес и ставке{' '}
                  {String(rate).replace('.', ',')}% — переплата {moneyShort(overpay)} ₽.
                </Typography>
              </Box>
              <Box sx={{ width: 140, height: 140, mx: 'auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={62}
                      stroke="none"
                    >
                      {pie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Typography sx={{ textAlign: 'center', fontSize: 11, color: '#9AA5B1', mt: -1 }}>
                  проценты {interestShare}%
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={tileSx}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35', mb: 1 }}>
              Динамика остатка долга, млн ₽
            </Typography>
            <Box sx={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={debtLine}>
                  <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip />
                  <Line type="monotone" dataKey="debt" stroke="#EF3124" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ ...tileSx, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography
            sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#0B1F35' }}
          >
            График платежей (ориентир)
          </Typography>
          <Button
            size="small"
            onClick={() => setShowAll((v) => !v)}
            sx={{ fontWeight: 700, textTransform: 'none', color: '#EF3124' }}
          >
            {showAll ? 'Свернуть' : `Показать все ${term} платежей →`}
          </Button>
        </Stack>
        <Box sx={{ overflow: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <Box component="thead">
              <Box component="tr">
                {['№', 'Дата', 'Платёж', 'Основной долг', 'Проценты', 'Остаток долга'].map((h) => (
                  <Box
                    component="th"
                    key={h}
                    sx={{
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#9AA5B1',
                      pb: 1,
                      borderBottom: '1px solid rgba(11,31,53,0.08)',
                      pr: 1.5,
                    }}
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {visibleRows.map((r) => (
                <Box
                  component="tr"
                  key={r.month}
                  sx={{
                    '& td': {
                      py: 1.1,
                      pr: 1.5,
                      fontSize: 13,
                      borderBottom: '1px solid rgba(11,31,53,0.05)',
                    },
                  }}
                >
                  <Box component="td" sx={{ color: '#9AA5B1' }}>
                    {r.month}
                  </Box>
                  <Box component="td" sx={{ color: '#5A6B7D' }}>
                    {fmtDate(r.date)}
                  </Box>
                  <Box component="td" sx={{ fontWeight: 700, color: '#0B1F35' }}>
                    {moneyShort(r.payment)}
                  </Box>
                  <Box component="td" sx={{ color: '#5A6B7D' }}>
                    {moneyShort(r.principal)}
                  </Box>
                  <Box component="td" sx={{ color: '#5A6B7D' }}>
                    {moneyShort(r.interest)}
                  </Box>
                  <Box component="td" sx={{ color: '#5A6B7D' }}>
                    {moneyShort(r.balance)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/app/scenarios')}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flex: 1 }}
        >
          К сценариям
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={toApplication}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            flex: 1.2,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          В заявку с этими параметрами
        </Button>
      </Stack>
    </Box>
  )
}

function ParamSlider({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  valueLabel: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <Box sx={{ mb: 1.75 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6B7D' }}>{label}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0B1F35' }}>{valueLabel}</Typography>
      </Stack>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(v as number)}
        sx={{ color: '#EF3124', py: 0.75, '& .MuiSlider-thumb': { width: 16, height: 16 } }}
      />
    </Box>
  )
}
