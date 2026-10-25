import { Box, Button, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useMemo } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
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

const MONTHS = ['Ноя', 'Дек', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт']

/** Weekly-ish balance shape across 12 months (млн) */
const BALANCE_SHAPE = [2.1, 2.6, 0.55, 0.4, 0.9, 1.4, 1.8, 2.0, 2.15, 2.2, 2.25, 2.3]

const COUNTERPARTIES = [
  { name: 'ООО «Зерно-Опт»', category: 'Поставщик', turn: 0.38, share: 38, bar: '#EF3124' },
  { name: 'ООО «Тверской Плаза»', category: 'Аренда', turn: 0.27, share: 18, bar: '#0B1F35' },
  { name: 'Эквайринг Альфа-Банк', category: 'Поступления', turn: 0.71, share: 71, bar: '#1B8A5A' },
  { name: 'ФНС России', category: 'Налоги', turn: 0.12, share: 12, bar: '#8A96A3' },
  { name: 'Сотрудники (ФОТ)', category: 'ФОТ', turn: 0.22, share: 22, bar: '#C5CCD3' },
]

const INCOME_SPLIT = [
  { name: 'Эквайринг', pct: 71, color: '#EF3124' },
  { name: 'Онлайн-заказы', pct: 19, color: '#0B1F35' },
  { name: 'Наличные / прочее', pct: 10, color: '#C5CCD3' },
]

function mln(n: number): string {
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} млн ₽`
}

function Kpi({
  label,
  value,
  hint,
  hintColor,
  valueColor,
}: {
  label: string
  value: string
  hint: string
  hintColor?: string
  valueColor?: string
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
          color: valueColor ?? '#0B1F35',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          mb: 0.5,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: hintColor ?? '#5A6B7D' }}>
        {hint}
      </Typography>
    </Box>
  )
}

export function StatementAnalysisPage() {
  const navigate = useNavigate()
  const { financials, refetchAll } = useAppStore()

  const revenue12 = (financials.avgMonthlyRevenue || 1_533_000) * 12
  const expenses12 = (financials.operatingExpenses || Math.round((financials.avgMonthlyRevenue || 1_533_000) * 0.86)) * 12
  const avgBal = financials.cashBalance || 2_100_000
  const minBal = 400_000

  const chartData = useMemo(() => {
    const scale = (avgBal || 2_100_000) / 2_100_000
    return MONTHS.map((label, i) => ({
      label,
      bal: +(BALANCE_SHAPE[i]! * scale).toFixed(2),
    }))
  }, [avgBal])

  const counterparties = useMemo(() => {
    const base = revenue12
    return COUNTERPARTIES.map((c) => ({
      ...c,
      amount: Math.round(base * c.turn * (c.category === 'Поступления' ? 1 : 0.55)),
    }))
  }, [revenue12])

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/statements"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Финансовый профиль
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Анализ выписки
        </Box>
      </Typography>

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
            Анализ выписки
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Период 01.11.2025 – 22.10.2026 · 4 862 операции · обработано за 48 с
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button
            variant="outlined"
            onClick={() => {
              refetchAll()
            }}
            sx={outlineBtn}
          >
            Пересчитать
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/recommendations')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              px: 2,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            К подбору кредита
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          mb: 2,
        }}
      >
        <Kpi label="Поступления" value={mln(revenue12 / 1_000_000)} hint="эквайринг 71%" />
        <Kpi label="Списания" value={mln(expenses12 / 1_000_000)} hint="без аномалий" />
        <Kpi
          label="Средний остаток"
          value={mln(avgBal / 1_000_000)}
          hint={`мин. ${(minBal / 1_000_000).toFixed(1)} млн`}
          hintColor="#EF3124"
        />
        <Kpi label="Кассовые разрывы" value="2" valueColor="#EF3124" hint="янв, фев 2026" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.5fr) minmax(280px, 0.9fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ ...tileSx, minHeight: 300 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.5,
              }}
            >
              Остаток на счёте по неделям, млн ₽
            </Typography>
            <Box sx={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF3124" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#EF3124" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,31,53,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#9AA5B1', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 3]}
                    tick={{ fill: '#9AA5B1', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toLocaleString('ru-RU')} млн ₽`, 'Остаток']}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(11,31,53,0.08)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bal"
                    stroke="#EF3124"
                    strokeWidth={2.5}
                    fill="url(#balFill)"
                    dot={{ r: 3, fill: '#EF3124', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>

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
              Топ контрагентов
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <Box component="thead">
                <Box component="tr">
                  {['Контрагент', 'Категория', 'Оборот', 'Доля'].map((h) => (
                    <Box
                      component="th"
                      key={h}
                      sx={{
                        textAlign: 'left',
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
                {counterparties.map((row) => (
                  <Box
                    component="tr"
                    key={row.name}
                    sx={{
                      '& td': {
                        py: 1.25,
                        pr: 1.25,
                        borderBottom: '1px solid rgba(11,31,53,0.06)',
                        verticalAlign: 'middle',
                      },
                    }}
                  >
                    <Box component="td">
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                        {row.name}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{row.category}</Typography>
                    </Box>
                    <Box component="td">
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                        {formatMoney(row.amount)}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ minWidth: 120 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 999,
                            bgcolor: '#E8EBEE',
                            overflow: 'hidden',
                            minWidth: 56,
                          }}
                        >
                          <Box
                            sx={{
                              width: `${Math.min(100, row.share)}%`,
                              height: '100%',
                              bgcolor: row.bar,
                              borderRadius: 999,
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: '#0B1F35', width: 36 }}>
                          {row.share}%
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Box sx={{ ...tileSx, position: 'relative' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                }}
              >
                Замечания анализа
              </Typography>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: '#FFF0E0',
                  color: '#C45A12',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                2
              </Box>
            </Stack>
            <Stack spacing={1.35}>
              <Stack direction="row" spacing={1.15} alignItems="flex-start">
                <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1 }} />
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                    Платёж 14.01.2026 — 640 000 ₽
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25, lineHeight: 1.4 }}>
                    Крупный разовый платёж — стоит пояснить менеджеру.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.15} alignItems="flex-start">
                <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1 }} />
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                    Поступления ниже расходов в янв–фев
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25, lineHeight: 1.4 }}>
                    Сезонный кассовый разрыв — учтите в графике кредита.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.15} alignItems="flex-start">
                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.1 }} />
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                    Нет блокировок и картотеки
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25, lineHeight: 1.4 }}>
                    По выписке задолженностей перед бюджетом не видно.
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1,
              }}
            >
              Структура поступлений
            </Typography>
            <Box sx={{ position: 'relative', width: '100%', height: 160, mb: 1 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={INCOME_SPLIT}
                    dataKey="pct"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {INCOME_SPLIT.map((e) => (
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
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0B1F35' }}>
                  {mln(revenue12 / 1_000_000).replace(' ₽', '')}
                </Typography>
              </Box>
            </Box>
            <Stack spacing={0.85}>
              {INCOME_SPLIT.map((e) => (
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
        </Stack>
      </Box>
    </Box>
  )
}
