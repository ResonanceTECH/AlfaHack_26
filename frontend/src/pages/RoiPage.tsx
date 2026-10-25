import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { evaluateProject } from '@/api/credit'
import type { ProjectEvaluationInput } from '@/types'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { annuityPayment } from '@/utils/finance'
import { saveScenarioHandoff } from '@/features/scenarios/handoff'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
  },
} as const

export function RoiPage() {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [investment, setInvestment] = useState(2_450_000)
  const [margin, setMargin] = useState(24)
  const [revenue, setRevenue] = useState(520_000)
  const [fixed, setFixed] = useState(210_000)
  const [credit, setCredit] = useState(3_000_000)
  const rate = 17.9
  const term = 24
  const payment = Math.round(annuityPayment(credit, rate, term))

  const monthlyCf = revenue * (margin / 100) - fixed - payment * 0.35
  const localPayback = monthlyCf > 0 ? Math.ceil(investment / monthlyCf) : 99
  const localNpv = useMemo(() => {
    let acc = -investment
    const r = rate / 100 / 12
    for (let m = 1; m <= 24; m++) {
      acc += monthlyCf / Math.pow(1 + r, m)
    }
    return Math.round(acc)
  }, [investment, monthlyCf, rate])

  const localChart = useMemo(() => {
    const pts: { m: number; cf: number }[] = []
    let acc = -investment / 1_000_000
    for (let m = 0; m <= 24; m++) {
      if (m > 0) acc += monthlyCf / 1_000_000
      if (m % 2 === 0 || m === 24) pts.push({ m, cf: Math.round(acc * 100) / 100 })
    }
    return pts
  }, [investment, monthlyCf])

  const evalInput: ProjectEvaluationInput = useMemo(
    () => ({
      initialInvestment: investment,
      creditAmount: credit,
      additionalSales: revenue,
      fixedCosts: fixed,
      variableCosts: Math.round(revenue * (1 - margin / 100)),
      creditRate: rate,
      creditTermMonths: term,
      horizonMonths: 24,
      discountRate: 12,
      ownFunds: 0,
      residualValue: 0,
      taxRate: 0,
    }),
    [investment, credit, revenue, fixed, margin, rate, term],
  )

  const evalQ = useQuery({
    queryKey: ['project-evaluate', evalInput],
    queryFn: () => evaluateProject(evalInput),
    retry: false,
  })

  const api = evalQ.data
  const paybackMonths = api?.simplePaybackMonths ?? localPayback
  const npv = api?.npv ?? localNpv
  const roi = api?.roi
  const chart = useMemo(() => {
    if (api?.cashFlows?.length) {
      return api.cashFlows
        .filter((_, i) => i % 2 === 0 || i === api.cashFlows.length - 1)
        .map((r) => ({ m: r.month, cf: Math.round((r.cumulative / 1_000_000) * 100) / 100 }))
    }
    return localChart
  }, [api, localChart])

  const sensitivity = [
    { margin: 20, vals: [22, 19, 18, 16, 15] },
    { margin: 24, vals: [20, 17, 16, 14, 13] },
    { margin: 28, vals: [17, 15, 14, 12, 11] },
  ]

  function toApplication() {
    saveScenarioHandoff({
      amount: credit,
      termMonths: term,
      rate,
      payment,
      source: 'roi',
    })
    navigate('/app/applications/new')
  }

  const kpis = [
    {
      label: 'Инвестиции',
      value: `${(investment / 1_000_000).toFixed(2).replace('.', ',')} млн ₽`,
      caption: 'аренда, ремонт, запуск',
      captionColor: '#9AA5B1',
    },
    {
      label: 'Окупаемость',
      value: paybackMonths != null ? `≈ ${paybackMonths} мес` : '—',
      caption:
        api?.discountedPaybackMonths != null
          ? `дисконтированная ≈ ${api.discountedPaybackMonths} мес`
          : `дисконтированная ≈ ${Math.min(24, (paybackMonths ?? 0) + 2)} мес`,
      captionColor: '#1B8A5A',
    },
    {
      label: 'NPV (24 мес)',
      value: `${npv >= 0 ? '+' : ''}${(npv / 1_000_000).toFixed(2).replace('.', ',')} млн ₽`,
      caption:
        roi != null
          ? `ROI ${String(Math.round(roi * 10) / 10).replace('.', ',')}%`
          : `ставка ${String(rate).replace('.', ',')}%`,
      captionColor: '#1B8A5A',
    },
    {
      label: 'Выручка точки',
      value: `${Math.round(revenue / 1000)} тыс ₽/мес`,
      caption: 'выход к 6-му месяцу',
      captionColor: '#9AA5B1',
    },
  ]

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
          Окупаемость проекта
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 1.25 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 24, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
            }}
          >
            Окупаемость проекта
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Запуск второй точки «Кофе Плюс — Тверская» · горизонт 24 мес
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setEditOpen((v) => !v)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Изменить допущения
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              void evalQ.refetch()
            }}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Сохранить
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 2,
        }}
      >
        {kpis.map((k) => (
          <Box key={k.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 0.65 }}>
              {k.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: '-0.02em',
                color: '#0B1F35',
                mb: 0.5,
              }}
            >
              {k.value}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: k.captionColor }}>
              {k.caption}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)' },
          mb: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35', mb: 1 }}>
            Накопленный денежный поток, млн ₽
          </Typography>
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,31,53,0.06)" />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9AA5B1' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <ReferenceLine y={0} stroke="#C5CCD3" />
                <Line type="monotone" dataKey="cf" stroke="#EF3124" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', mt: 1, lineHeight: 1.4 }}>
            Проект выходит в плюс около {paybackMonths ?? '—'}
            -го месяца при плановой выручке.
          </Typography>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.5,
            }}
          >
            Допущения проекта
          </Typography>
          {editOpen ? (
            <Stack spacing={1.25} sx={{ mb: 1.75 }}>
              <TextField
                size="small"
                label="Инвестиции, ₽"
                type="number"
                value={investment}
                onChange={(e) => setInvestment(Number(e.target.value) || 0)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                label="Маржа точки, %"
                type="number"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value) || 0)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                label="Выручка, ₽/мес"
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value) || 0)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                label="Постоянные расходы, ₽"
                type="number"
                value={fixed}
                onChange={(e) => setFixed(Number(e.target.value) || 0)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                label="Кредит, ₽"
                type="number"
                value={credit}
                onChange={(e) => setCredit(Number(e.target.value) || 0)}
                sx={fieldSx}
              />
            </Stack>
          ) : (
            <Stack spacing={0.85} sx={{ mb: 1.75 }}>
              {[
                ['Инвестиции', `${investment.toLocaleString('ru-RU')} ₽`],
                ['Маржа точки', `${margin}%`],
                ['Выручка в зрелости', `${revenue.toLocaleString('ru-RU')} ₽`],
                ['Постоянные расходы', `${fixed.toLocaleString('ru-RU')} ₽`],
                ['Финансирование', `Кредит ${(credit / 1_000_000).toFixed(0)} млн ₽`],
                ['Платёж по кредиту', `≈ ${payment.toLocaleString('ru-RU')} ₽`],
              ].map(([k, v]) => (
                <Stack key={k} direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontSize: 13, color: '#7A8795' }}>{k}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35' }}>{v}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              p: 1.35,
              borderRadius: 2,
              bgcolor: '#E6F5EE',
              border: '1px solid rgba(27,138,90,0.25)',
            }}
          >
            <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.1 }} />
            <Typography sx={{ fontSize: 13, color: '#1B5C40', lineHeight: 1.45, fontWeight: 600 }}>
              Проект окупается после выхода на плановую выручку.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
        <Typography
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#0B1F35', mb: 1.5 }}
        >
          Чувствительность окупаемости, мес
        </Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={thSx}>
                Маржа \ выручка
              </Box>
              {['−20%', '−10%', 'План', '+10%', '+20%'].map((h) => (
                <Box component="th" key={h} sx={{ ...thSx, textAlign: 'center' }}>
                  {h}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {sensitivity.map((row) => (
              <Box
                component="tr"
                key={row.margin}
                sx={{
                  '& td': {
                    py: 1.1,
                    borderBottom: '1px solid rgba(11,31,53,0.05)',
                    fontSize: 13.5,
                    textAlign: 'center',
                  },
                }}
              >
                <Box
                  component="td"
                  sx={{ textAlign: 'left !important', fontWeight: 700, color: '#0B1F35', pl: 0.5 }}
                >
                  {row.margin}%{row.margin === 24 ? ' · план' : ''}
                </Box>
                {row.vals.map((v, i) => (
                  <Box
                    component="td"
                    key={i}
                    sx={{
                      fontWeight: row.margin === 24 && i === 2 ? 800 : 600,
                      color: row.margin === 24 && i === 2 ? '#EF3124' : '#5A6B7D',
                    }}
                  >
                    {v}
                  </Box>
                ))}
              </Box>
            ))}
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

const thSx = {
  textAlign: 'left' as const,
  fontSize: 12,
  fontWeight: 700,
  color: '#9AA5B1',
  pb: 1,
  borderBottom: '1px solid rgba(11,31,53,0.08)',
}
