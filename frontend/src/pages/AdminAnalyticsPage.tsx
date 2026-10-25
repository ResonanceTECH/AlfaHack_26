import Grid from '@mui/material/Grid2'
import {
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 2, md: 2.25 },
  height: '100%',
} as const

type FunnelRow = {
  stage: string
  count: number
  conversionPct: number
  avgHours: number
  dropoffPct: number
  bar: 'ink' | 'red' | 'green'
}

const FUNNEL: FunnelRow[] = [
  { stage: 'Подана', count: 1284, conversionPct: 100, avgHours: 0.2, dropoffPct: 0, bar: 'ink' },
  { stage: 'Автопроверки', count: 1104, conversionPct: 86, avgHours: 0.23, dropoffPct: 14, bar: 'ink' },
  { stage: 'Документы', count: 1020, conversionPct: 79, avgHours: 6.3, dropoffPct: 8, bar: 'ink' },
  { stage: 'Аналитик', count: 950, conversionPct: 74, avgHours: 28, dropoffPct: 7, bar: 'red' },
  { stage: 'Риск-оценка', count: 860, conversionPct: 67, avgHours: 5.2, dropoffPct: 9, bar: 'ink' },
  {
    stage: 'Решение: одобрено',
    count: 796,
    conversionPct: 62,
    avgHours: 22,
    dropoffPct: 7,
    bar: 'green',
  },
  {
    stage: 'Принято клиентом',
    count: 402,
    conversionPct: 31,
    avgHours: 55,
    dropoffPct: 50,
    bar: 'green',
  },
]

const PRODUCT_KPIS = [
  { label: 'Заявок в периоде', value: '1 284', trend: '+8.2%', up: true },
  { label: 'Выдано', value: '13.3 млрд', hint: 'принято клиентом' },
  { label: 'Approval → take-up', value: '50%', hint: '796 → 402' },
  { label: 'Ср. ставка выдачи', value: '18.1%', hint: 'взвеш. по объёму' },
  { label: 'Авто-решение', value: '41%', hint: 'без эскалации' },
]

const BY_PRODUCT = [
  { product: 'Оборотный', apps: 612, approval: 64, takeUp: 54, volume: 4.2 },
  { product: 'Инвестиц.', apps: 346, approval: 58, takeUp: 41, volume: 6.8 },
  { product: 'Овердрафт', apps: 198, approval: 71, takeUp: 61, volume: 0.9 },
  { product: 'Линия', apps: 128, approval: 55, takeUp: 38, volume: 1.4 },
]

const BY_CHANNEL = [
  { channel: 'Web', apps: 742, conv: 61 },
  { channel: 'Аналитик', apps: 318, conv: 68 },
  { channel: 'Партнёр', apps: 224, conv: 54 },
]

const VOLUME_WEEKLY = [
  { week: '36', volume: 2.8 },
  { week: '37', volume: 3.1 },
  { week: '38', volume: 2.9 },
  { week: '39', volume: 3.4 },
  { week: '40', volume: 3.2 },
  { week: '41', volume: 3.6 },
  { week: '42', volume: 3.3 },
  { week: '43', volume: 1.1 },
]

const REJECT_REASONS = [
  { name: 'Низкий DSCR', value: 34, fill: color.primary.main },
  { name: 'Кредитная история', value: 24, fill: color.secondary.main },
  { name: 'Нехватка документов', value: 18, fill: color.secondary.light },
  { name: 'Падение выручки', value: 14, fill: '#5A6B7D' },
  { name: 'Прочее', value: 10, fill: '#B0B8C2' },
]

const WEEKLY_CONV = [
  { week: '36', pct: 58 },
  { week: '37', pct: 61 },
  { week: '38', pct: 59 },
  { week: '39', pct: 63 },
  { week: '40', pct: 62 },
  { week: '41', pct: 65 },
  { week: '42', pct: 64 },
  { week: '43', pct: 62 },
]

const SLA_BY_SEGMENT = [
  { segment: 'A', hours: 18 },
  { segment: 'B+', hours: 26 },
  { segment: 'B', hours: 30 },
  { segment: 'C', hours: 44 },
]

const barColor = (kind: FunnelRow['bar']) => {
  if (kind === 'red') return color.primary.main
  if (kind === 'green') return color.semantic.success
  return color.secondary.main
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} мин`
  if (h < 24) {
    const whole = Math.floor(h)
    const mins = Math.round((h - whole) * 60)
    return mins ? `${whole}ч ${mins}м` : `${h} ч`
  }
  const d = Math.floor(h / 24)
  const rem = Math.round(h % 24)
  return rem ? `${d}д ${rem}ч` : `${d}д`
}

export function AdminAnalyticsPage() {
  const [period, setPeriod] = useState('30')
  const [product, setProduct] = useState('all')
  const [channel, setChannel] = useState('all')
  const [region, setRegion] = useState('all')

  return (
    <Box>
      <PageHeader
        title="Аналитика конвейера"
        subtitle="Конверсия, продукты, время и причины отказов"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Экспорт CSV
            </Button>
            <Button
              variant="contained"
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Применить
            </Button>
          </>
        }
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ mb: 2 }}
        useFlexGap
        flexWrap="wrap"
      >
        <TextField
          select
          size="small"
          label="Период"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="7">7 дней</MenuItem>
          <MenuItem value="30">30 дней</MenuItem>
          <MenuItem value="90">90 дней</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Продукт"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="working_capital">Оборотный</MenuItem>
          <MenuItem value="investment">Инвестиционный</MenuItem>
          <MenuItem value="overdraft">Овердрафт</MenuItem>
          <MenuItem value="credit_line">Линия</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Канал"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="web">Web</MenuItem>
          <MenuItem value="analyst">Аналитик</MenuItem>
          <MenuItem value="partner">Партнёр</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Регион"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="msk">Москва</MenuItem>
          <MenuItem value="spb">СПб</MenuItem>
          <MenuItem value="other">Другие</MenuItem>
        </TextField>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {PRODUCT_KPIS.map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ ...tileSx, p: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: color.text.secondary, mb: 0.75 }}>
                {k.label}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography
                  sx={{
                    fontFamily: font.display,
                    fontWeight: 750,
                    fontSize: 24,
                    letterSpacing: '-0.03em',
                    color: color.text.primary,
                    lineHeight: 1.1,
                  }}
                >
                  {k.value}
                </Typography>
                {k.trend && (
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: k.up ? color.semantic.success : color.semantic.error,
                    }}
                  >
                    {k.trend}
                  </Typography>
                )}
              </Stack>
              {k.hint && (
                <Typography sx={{ fontSize: 11.5, color: color.text.muted, mt: 0.5 }}>{k.hint}</Typography>
              )}
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ ...tileSx, overflow: 'auto' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 1.5,
                color: color.text.primary,
              }}
            >
              Воронка конвейера
            </Typography>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Этап</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Заявок
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary, minWidth: 140 }}>
                    Конверсия
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Время ср.
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Отток
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {FUNNEL.map((row) => (
                  <TableRow key={row.stage}>
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: color.text.primary }}>
                        {row.stage}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>
                        {row.count.toLocaleString('ru-RU')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            flex: 1,
                            height: 8,
                            borderRadius: `${radius.pill}px`,
                            bgcolor: color.secondary.soft06,
                            overflow: 'hidden',
                            minWidth: 64,
                          }}
                        >
                          <Box
                            sx={{
                              width: `${row.conversionPct}%`,
                              height: '100%',
                              bgcolor: barColor(row.bar),
                              borderRadius: `${radius.pill}px`,
                            }}
                          />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: color.text.secondary,
                            minWidth: 36,
                          }}
                        >
                          {row.conversionPct}%
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: 13, color: color.text.secondary }}>
                        {formatHours(row.avgHours)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: 13, color: color.text.secondary }}>
                        {row.dropoffPct}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 1,
                color: color.text.primary,
              }}
            >
              Причины отказов и отсева
            </Typography>
            <Box sx={{ height: 180, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={REJECT_REASONS}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {REJECT_REASONS.map((r) => (
                      <Cell key={r.name} fill={r.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [`${v ?? 0}%`, String(name)]}
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                  pb: 0.5,
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontFamily: font.display,
                      fontWeight: 800,
                      fontSize: 22,
                      lineHeight: 1,
                      color: color.text.primary,
                    }}
                  >
                    154
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: color.text.muted, fontWeight: 600 }}>
                    отказа
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Stack spacing={0.75} sx={{ mt: 0.5, mb: 2 }}>
              {REJECT_REASONS.map((r) => (
                <Stack key={r.name} direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: r.fill, flexShrink: 0 }} />
                  <Typography sx={{ flex: 1, fontSize: 12.5, color: color.text.primary }}>
                    {r.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.text.secondary }}>
                    {r.value}%
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Box sx={{ pt: 1.5, borderTop: `1px solid ${color.semantic.divider}` }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: color.text.primary }}>
                  Counteroffer
                </Typography>
                <Typography sx={{ fontSize: 12, color: color.text.muted }}>
                  14% заявок · принято 71%
                </Typography>
              </Stack>
              <Box
                sx={{
                  height: 8,
                  borderRadius: `${radius.pill}px`,
                  bgcolor: color.secondary.soft06,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: '71%',
                    height: '100%',
                    bgcolor: color.semantic.success,
                    borderRadius: `${radius.pill}px`,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Box sx={{ ...tileSx, overflow: 'auto' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 0.25,
                color: color.text.primary,
              }}
            >
              Продуктовая доска
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 1.5 }}>
              Approval / take-up / объём выдач по типу продукта
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Продукт</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Заявки
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Approval
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Take-up
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Объём, млрд
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {BY_PRODUCT.map((p) => (
                  <TableRow key={p.product} hover>
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>{p.product}</Typography>
                    </TableCell>
                    <TableCell align="right">{p.apps}</TableCell>
                    <TableCell align="right">{p.approval}%</TableCell>
                    <TableCell align="right">{p.takeUp}%</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{p.volume}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 0.25,
                color: color.text.primary,
              }}
            >
              Каналы привлечения
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              Заявки и конверсия в одобрение
            </Typography>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BY_CHANNEL} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="channel"
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: color.text.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="apps" name="Заявки" fill={color.primary.main} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {BY_CHANNEL.map((c) => (
                <Typography key={c.channel} sx={{ fontSize: 12, color: color.text.muted }}>
                  {c.channel}: <Box component="span" sx={{ fontWeight: 700, color: color.text.primary }}>{c.conv}%</Box>
                </Typography>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 2,
                color: color.text.primary,
              }}
            >
              Конверсия в одобрение по неделям, %
            </Typography>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={WEEKLY_CONV} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color.primary.main} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={color.primary.main} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 70]}
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`${v ?? 0}%`, 'Конверсия']}
                    labelFormatter={(l) => `Неделя ${l}`}
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="pct" fill="url(#convFill)" stroke="none" />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke={color.primary.main}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: color.primary.main, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 2,
                color: color.text.primary,
              }}
            >
              Время до решения, часы
            </Typography>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SLA_BY_SEGMENT} margin={{ top: 24, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="segment"
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: color.text.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [`${v ?? 0} ч`, 'SLA']}
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                    fill={color.secondary.main}
                    label={{
                      position: 'top',
                      fill: color.text.secondary,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Typography sx={{ fontSize: 12, color: color.text.muted, mt: 0.5 }}>
              Сегмент риска клиента
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 0.25,
                color: color.text.primary,
              }}
            >
              Объём выдач по неделям, млрд ₽
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              Принятые клиентом офферы
            </Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={VOLUME_WEEKLY} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: color.text.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [`${v ?? 0} млрд`, 'Объём']}
                    labelFormatter={(l) => `Неделя ${l}`}
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="volume" radius={[6, 6, 0, 0]} maxBarSize={36} fill={color.semantic.success} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
