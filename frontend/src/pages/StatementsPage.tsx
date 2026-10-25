import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
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
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney } from '@/utils/format'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const outlineBtn = {
  borderRadius: 2,
  borderColor: 'rgba(11,31,53,0.14)',
  color: '#0B1F35',
  fontWeight: 600,
  textTransform: 'none' as const,
  bgcolor: '#fff',
  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_FULL = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Demo shape ноя 2025 – окт 2026, scaled to avg monthly revenue */
const SHAPE = [
  { m: 10, y: 2025, rev: 1.35, exp: 1.15, bal: 1.9 }, // ноя
  { m: 11, y: 2025, rev: 1.85, exp: 1.45, bal: 2.4 }, // дек peak
  { m: 0, y: 2026, rev: 1.05, exp: 1.0, bal: 0.4 }, // янв dip
  { m: 1, y: 2026, rev: 1.1, exp: 1.02, bal: 0.55 },
  { m: 2, y: 2026, rev: 1.25, exp: 1.08, bal: 1.2 },
  { m: 3, y: 2026, rev: 1.32, exp: 1.12, bal: 1.6 },
  { m: 4, y: 2026, rev: 1.38, exp: 1.15, bal: 1.9 },
  { m: 5, y: 2026, rev: 1.42, exp: 1.18, bal: 2.0 },
  { m: 6, y: 2026, rev: 1.48, exp: 1.22, bal: 2.15 },
  { m: 7, y: 2026, rev: 1.52, exp: 1.25, bal: 2.2 },
  { m: 8, y: 2026, rev: 1.55, exp: 1.28, bal: 2.25 },
  { m: 9, y: 2026, rev: 1.58, exp: 1.3, bal: 2.3 }, // окт
]

const EXPENSE_SPLIT = [
  { name: 'Сырьё и товары', pct: 38, color: '#EF3124' },
  { name: 'ФОТ и налоги', pct: 27, color: '#0B1F35' },
  { name: 'Аренда', pct: 18, color: '#8A96A3' },
  { name: 'Маркетинг', pct: 10, color: '#C5CCD3' },
  { name: 'Прочее', pct: 7, color: '#E8EBEE' },
]

function mln(n: number): string {
  const v = n / 1_000_000
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} млн ₽`
}

function mlnShort(n: number): string {
  return (n / 1_000_000).toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })
}

function KpiCard({
  label,
  value,
  hint,
  hintTone,
  bar,
  barColor,
}: {
  label: string
  value: string
  hint: string
  hintTone: 'green' | 'muted' | 'red'
  bar: number
  barColor: string
}) {
  return (
    <Box sx={tileSx}>
      <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', fontWeight: 600, mb: 0.75 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: 22,
          fontWeight: 800,
          color: '#0B1F35',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          mb: 0.75,
        }}
      >
        {value}
      </Typography>
      <Typography
        sx={{
          fontSize: 12.5,
          fontWeight: 700,
          mb: 1.25,
          color:
            hintTone === 'green' ? '#1B8A5A' : hintTone === 'red' ? '#EF3124' : '#5A6B7D',
        }}
      >
        {hint}
      </Typography>
      <Box sx={{ height: 6, borderRadius: 999, bgcolor: '#E8EBEE', overflow: 'hidden' }}>
        <Box
          sx={{
            width: `${Math.min(100, Math.max(0, bar))}%`,
            height: '100%',
            bgcolor: barColor,
            borderRadius: 999,
          }}
        />
      </Box>
    </Box>
  )
}

export function StatementsPage() {
  const navigate = useNavigate()
  const { financials, refetchAll } = useAppStore()
  const [flash, setFlash] = useState<string | null>(null)

  const baseRev = financials.avgMonthlyRevenue || 1_533_000
  const baseExp =
    financials.operatingExpenses || Math.round(baseRev * 0.86)
  const baseBal = financials.cashBalance || 2_100_000

  const series = useMemo(() => {
    const avgShapeRev = SHAPE.reduce((s, x) => s + x.rev, 0) / SHAPE.length
    const scaleRev = baseRev / avgShapeRev
    const scaleExp = baseExp / (SHAPE.reduce((s, x) => s + x.exp, 0) / SHAPE.length)
    const scaleBal = baseBal / (SHAPE.reduce((s, x) => s + x.bal, 0) / SHAPE.length)
    return SHAPE.map((x) => {
      const revenue = Math.round(x.rev * scaleRev)
      const expenses = Math.round(x.exp * scaleExp)
      const profit = revenue - expenses
      const balance = Math.round(x.bal * scaleBal)
      return {
        key: `${x.y}-${x.m}`,
        label: MONTHS_RU[x.m]!,
        full: `${MONTHS_FULL[x.m]} ${x.y}`,
        short: `${MONTHS_FULL[x.m]!.slice(0, 3)} ${String(x.y).slice(2)}`,
        revenue,
        expenses,
        profit,
        balance,
        revMln: +(revenue / 1_000_000).toFixed(2),
        expMln: +(expenses / 1_000_000).toFixed(2),
      }
    })
  }, [baseRev, baseExp, baseBal])

  const totals = useMemo(() => {
    const revenue = series.reduce((s, x) => s + x.revenue, 0)
    const expenses = series.reduce((s, x) => s + x.expenses, 0)
    const profit = revenue - expenses
    const avgBalance = Math.round(series.reduce((s, x) => s + x.balance, 0) / series.length)
    const minBal = series.reduce((a, b) => (a.balance < b.balance ? a : b))
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0
    const expShare = revenue > 0 ? (expenses / revenue) * 100 : 0
    return { revenue, expenses, profit, avgBalance, minBal, margin, expShare }
  }, [series])

  const expensePie = useMemo(
    () =>
      EXPENSE_SPLIT.map((e) => ({
        ...e,
        value: Math.round((totals.expenses * e.pct) / 100),
      })),
    [totals.expenses],
  )

  const tableRows = useMemo(() => [...series].reverse().slice(0, 5), [series])

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Финансовый профиль
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Источник: выписка и данные бухгалтерии · период ноя 2025 – окт 2026
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() => {
              refetchAll()
              setFlash('Данные обновлены')
            }}
            sx={outlineBtn}
          >
            Обновить данные
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/statements/upload')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              px: 2,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Загрузить выписку
          </Button>
        </Stack>
      </Stack>

      {flash && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setFlash(null)}>
          {flash}
        </Alert>
      )}

      {/* KPI row */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          mb: 2,
        }}
      >
        <KpiCard
          label="Выручка 12 мес"
          value={mln(totals.revenue)}
          hint="+6,2% к прошлому году"
          hintTone="green"
          bar={72}
          barColor="#1B8A5A"
        />
        <KpiCard
          label="Расходы 12 мес"
          value={mln(totals.expenses)}
          hint={`${totals.expShare.toFixed(0)}% от выручки`}
          hintTone="muted"
          bar={totals.expShare}
          barColor="#0B1F35"
        />
        <KpiCard
          label="Чистая прибыль"
          value={mln(totals.profit)}
          hint={`маржа ${totals.margin.toFixed(1)}%`}
          hintTone="green"
          bar={Math.min(100, totals.margin * 4)}
          barColor="#0B1F35"
        />
        <KpiCard
          label="Средний остаток"
          value={mln(totals.avgBalance)}
          hint={`мин. ${mlnShort(totals.minBal.balance)} млн в янв`}
          hintTone="red"
          bar={45}
          barColor="#EF3124"
        />
      </Box>

      {/* Charts */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.45fr) minmax(260px, 0.85fr)' },
          mb: 2,
        }}
      >
        <Box sx={{ ...tileSx, minHeight: 320 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
            flexWrap="wrap"
            gap={1}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
              }}
            >
              Выручка и расходы, млн ₽
            </Typography>
            <Stack direction="row" spacing={2}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF3124' }} />
                <Typography sx={{ fontSize: 12, color: '#5A6B7D', fontWeight: 600 }}>
                  Выручка
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0B1F35' }} />
                <Typography sx={{ fontSize: 12, color: '#5A6B7D', fontWeight: 600 }}>
                  Расходы
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <Box sx={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,31,53,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9AA5B1', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9AA5B1', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(v, name) => [
                    `${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`,
                    name === 'revMln' ? 'Выручка' : 'Расходы',
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(11,31,53,0.08)',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revMln"
                  stroke="#EF3124"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="expMln"
                  stroke="#0B1F35"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box sx={{ ...tileSx, minHeight: 320 }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1,
            }}
          >
            Структура расходов
          </Typography>
          <Box sx={{ position: 'relative', width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={expensePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={74}
                  paddingAngle={2}
                  stroke="none"
                >
                  {expensePie.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35' }}>
                {mlnShort(totals.expenses)} млн ₽
              </Typography>
            </Box>
          </Box>
          <Stack spacing={0.85} sx={{ mt: 0.5 }}>
            {EXPENSE_SPLIT.map((e) => (
              <Stack key={e.name} direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: e.color }} />
                <Typography sx={{ flex: 1, fontSize: 13, color: '#5A6B7D' }}>{e.name}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#0B1F35' }}>
                  {e.pct}%
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Table + insights */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.45fr) minmax(260px, 0.85fr)' },
        }}
      >
        <Box sx={{ ...tileSx, overflow: 'auto' }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.5,
            }}
          >
            Помесячный отчёт
          </Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <Box component="thead">
              <Box component="tr">
                {['Месяц', 'Выручка', 'Расходы', 'Прибыль', 'Остаток', 'Тренд'].map((h) => (
                  <Box
                    component="th"
                    key={h}
                    sx={{
                      textAlign: h === 'Тренд' ? 'center' : 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#9AA5B1',
                      pb: 1.1,
                      pr: 1.25,
                      borderBottom: '1px solid rgba(11,31,53,0.08)',
                    }}
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {tableRows.map((row, i) => {
                const prev = tableRows[i + 1]
                const up = !prev || row.revenue >= prev.revenue
                return (
                  <Box
                    component="tr"
                    key={row.key}
                    sx={{
                      '& td': {
                        py: 1.25,
                        pr: 1.25,
                        borderBottom: '1px solid rgba(11,31,53,0.06)',
                        fontSize: 13.5,
                        color: '#0B1F35',
                      },
                    }}
                  >
                    <Box component="td" sx={{ fontWeight: 700 }}>
                      {row.short}
                    </Box>
                    <Box component="td">{formatMoney(row.revenue)}</Box>
                    <Box component="td">{formatMoney(row.expenses)}</Box>
                    <Box component="td" sx={{ fontWeight: 700, color: '#1B8A5A !important' }}>
                      {formatMoney(row.profit)}
                    </Box>
                    <Box component="td">{formatMoney(row.balance)}</Box>
                    <Box component="td" sx={{ textAlign: 'center' }}>
                      {up ? (
                        <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#1B8A5A' }} />
                      ) : (
                        <FiberManualRecordIcon sx={{ fontSize: 10, color: '#C5CCD3' }} />
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
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
            Выводы по профилю
          </Typography>
          <Stack spacing={1.5}>
            {[
              {
                ok: true,
                text: 'Выручка растёт 8 месяцев подряд — профиль устойчивый для оборотного кредита.',
              },
              {
                ok: false,
                text: `Сезонный провал янв–фев: остаток падал до ${mlnShort(totals.minBal.balance)} млн ₽ — заложите резерв.`,
              },
              {
                ok: true,
                text: 'Налоговой задолженности за 12 месяцев не зафиксировано (по выписке).',
              },
            ].map((item) => (
              <Stack key={item.text} direction="row" spacing={1.25} alignItems="flex-start">
                {item.ok ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.15 }} />
                ) : (
                  <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.15 }} />
                )}
                <Typography sx={{ fontSize: 13.5, color: '#0B1F35', lineHeight: 1.45, fontWeight: 550 }}>
                  {item.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
