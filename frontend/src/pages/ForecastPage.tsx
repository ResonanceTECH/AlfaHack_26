import {
  Box,
  Button,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
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
import { annuityPayment } from '@/utils/finance'
import { saveScenarioHandoff } from '@/features/scenarios/handoff'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const MONTHS = ['ноя', 'дек', 'янв', 'фев', 'мар', 'апр'] as const

export function ForecastPage() {
  const navigate = useNavigate()
  const [revenueGrowth, setRevenueGrowth] = useState(6)
  const [decPeak, setDecPeak] = useState(1.3)
  const [loanAmount] = useState(3_000_000)
  const [loanRate] = useState(17.9)
  const [loanTerm] = useState(24)
  const [payment, setPayment] = useState(() => Math.round(annuityPayment(3_000_000, 17.9, 24)))
  const [includeGoal, setIncludeGoal] = useState(true)
  const [includeTax, setIncludeTax] = useState(true)
  const [assumptionsOpen, setAssumptionsOpen] = useState(true)

  const baseInflow = [2.1, 2.4, 1.9, 1.85, 2.05, 2.2]
  const baseOpex = [1.55, 1.7, 1.5, 1.48, 1.52, 1.58]
  const goalExp = includeGoal ? [0.35, 0.55, 0.4, 0.38, 0.42, 0.45] : [0, 0, 0, 0, 0, 0]
  const tax = includeTax ? [0.12, 0.14, 0.11, 0.11, 0.12, 0.13] : [0, 0, 0, 0, 0, 0]

  const rows = useMemo(() => {
    const payMln = payment / 1_000_000
    let balNo = 0.9
    let balYes = 0.9 + loanAmount / 1_000_000 * 0.35
    return MONTHS.map((m, i) => {
      const season = m === 'дек' ? decPeak : 1
      const growth = 1 + revenueGrowth / 100
      const inflow = baseInflow[i]! * season * (0.97 + growth * 0.03)
      const opex = baseOpex[i]!
      const goal = goalExp[i]!
      const taxRow = tax[i]!
      balNo = Math.round((balNo + inflow - opex - goal - taxRow) * 100) / 100
      balYes =
        Math.round((balYes + inflow - opex - goal - taxRow - (i === 0 ? 0 : payMln)) * 100) / 100
      if (i === 0) balYes = Math.round((balYes + loanAmount / 1_000_000) * 100) / 100
      return {
        month: m,
        inflow: Math.round(inflow * 100) / 100,
        opex: Math.round(opex * 100) / 100,
        goal: Math.round(goal * 100) / 100,
        balNo,
        pay: i === 0 ? 0 : Math.round(payMln * 100) / 100,
        balYes,
      }
    })
  }, [revenueGrowth, decPeak, payment, includeGoal, includeTax, loanAmount])

  const chartData = rows.map((r) => ({
    month: r.month,
    without: r.balNo,
    withLoan: r.balYes,
  }))

  const firstNeg = rows.find((r) => r.balNo < 0)
  const minNo = Math.min(...rows.map((r) => r.balNo))
  const conclusion = firstNeg
    ? `Без финансирования остаток на счёте уйдёт в минус уже в ${firstNeg.month} (${firstNeg.balNo} млн ₽), минимум ${minNo} млн ₽. С кредитом ${(loanAmount / 1_000_000).toFixed(0)} млн ₽ остаток остаётся положительным.`
    : `С текущими допущениями остаток без кредита остаётся в плюсе. Кредит ${(loanAmount / 1_000_000).toFixed(0)} млн ₽ даёт запас ликвидности.`

  function toApplication() {
    saveScenarioHandoff({
      amount: loanAmount,
      termMonths: loanTerm,
      rate: loanRate,
      payment,
      source: 'forecast',
    })
    navigate('/app/applications/new')
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
          Прогноз денежных средств
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
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
          Прогноз денежных средств
        </Typography>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setAssumptionsOpen((v) => !v)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Настроить допущения
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/scenarios')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            К сценариям
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          alignItems: 'flex-start',
          px: 1.75,
          py: 1.4,
          borderRadius: 2.5,
          bgcolor: '#FDE8E6',
          border: '1px solid rgba(196,30,20,0.2)',
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            bgcolor: '#EF3124',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            mt: 0.1,
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 14 }} />
        </Box>
        <Typography sx={{ fontSize: 13.5, color: '#7A3A35', lineHeight: 1.5, fontWeight: 600 }}>
          {conclusion}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            md: assumptionsOpen ? 'minmax(0, 1.25fr) minmax(260px, 0.75fr)' : '1fr',
          },
          mb: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35', mb: 1.25 }}>
            Остаток на конец месяца, млн ₽
          </Typography>
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,31,53,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9AA5B1' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9AA5B1' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="without"
                  name="Без кредита"
                  stroke="#EF3124"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="withLoan"
                  name={`Кредит ${(loanAmount / 1_000_000).toFixed(0)} млн ₽ · ${String(loanRate).replace('.', ',')}%`}
                  stroke="#1B8A5A"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {assumptionsOpen && (
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
              Допущения
            </Typography>
            <AssumptionSlider
              label="Рост выручки"
              valueLabel={`+${revenueGrowth}% г/г`}
              value={revenueGrowth}
              min={0}
              max={20}
              step={1}
              onChange={setRevenueGrowth}
            />
            <AssumptionSlider
              label="Сезонный пик дек"
              valueLabel={`×${String(decPeak).replace('.', ',')}`}
              value={decPeak}
              min={1}
              max={1.8}
              step={0.05}
              onChange={setDecPeak}
            />
            <AssumptionSlider
              label="Платёж по кредиту"
              valueLabel={`${payment.toLocaleString('ru-RU')} ₽`}
              value={payment}
              min={80_000}
              max={250_000}
              step={1_000}
              onChange={setPayment}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={includeGoal}
                  onChange={(_, v) => setIncludeGoal(v)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#EF3124' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#EF3124' },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Учитывать расходы цели</Typography>
              }
              sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse', ml: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={includeTax}
                  onChange={(_, v) => setIncludeTax(v)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#EF3124' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#EF3124' },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
                  Учитывать налоговые платежи
                </Typography>
              }
              sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse', ml: 0 }}
            />
          </Box>
        )}
      </Box>

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
        <Typography
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#0B1F35', mb: 1.5 }}
        >
          Помесячные цифры, млн ₽
        </Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={thSx}>
                Статья
              </Box>
              {MONTHS.map((m) => (
                <Box component="th" key={m} sx={{ ...thSx, textAlign: 'right' }}>
                  {m}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            <TableRow label="Поступления" values={rows.map((r) => r.inflow)} />
            <TableRow label="Операционные расходы" values={rows.map((r) => r.opex)} />
            <TableRow label="Расходы цели" values={rows.map((r) => r.goal)} />
            <TableRow
              label="Остаток без финансирования"
              values={rows.map((r) => r.balNo)}
              emphasize
            />
            <TableRow label="Платёж по кредиту" values={rows.map((r) => r.pay)} />
            <TableRow
              label="Остаток с кредитом"
              values={rows.map((r) => r.balYes)}
              emphasize
              bold
            />
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
  pr: 1.25,
  borderBottom: '1px solid rgba(11,31,53,0.08)',
}

function TableRow({
  label,
  values,
  emphasize,
  bold,
}: {
  label: string
  values: number[]
  emphasize?: boolean
  bold?: boolean
}) {
  return (
    <Box
      component="tr"
      sx={{
        '& td': {
          py: 1.05,
          pr: 1.25,
          fontSize: 13,
          borderBottom: '1px solid rgba(11,31,53,0.05)',
        },
      }}
    >
      <Box
        component="td"
        sx={{
          fontWeight: bold || emphasize ? 700 : 600,
          color: '#0B1F35',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Box>
      {values.map((v, i) => (
        <Box
          component="td"
          key={i}
          sx={{
            textAlign: 'right',
            fontWeight: bold || emphasize ? 800 : 600,
            color: emphasize ? (v < 0 ? '#C41E14' : '#1B8A5A') : '#5A6B7D',
          }}
        >
          {v.toFixed(2).replace('.', ',')}
        </Box>
      ))}
    </Box>
  )
}

function AssumptionSlider({
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
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#0B1F35' }}>{valueLabel}</Typography>
      </Stack>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(v as number)}
        sx={{ color: '#EF3124', py: 0.5, '& .MuiSlider-thumb': { width: 16, height: 16 } }}
      />
    </Box>
  )
}
