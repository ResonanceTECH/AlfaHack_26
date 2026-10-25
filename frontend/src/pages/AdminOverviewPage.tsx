import Grid from '@mui/material/Grid2'
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const weeklyApps = [
  { week: '36', value: 268, current: false },
  { week: '37', value: 312, current: false },
  { week: '38', value: 289, current: false },
  { week: '39', value: 341, current: false },
  { week: '40', value: 298, current: false },
  { week: '41', value: 352, current: false },
  { week: '42', value: 327, current: false },
  { week: '43', value: 118, current: true },
]

const funnel = [
  { label: 'Подано', value: 1284, fill: color.secondary.main },
  { label: 'Проверки пройдены', value: 1104, fill: color.secondary.light },
  { label: 'На рассмотрении', value: 950, fill: color.primary.main },
  { label: 'Одобрено', value: 796, fill: color.semantic.success },
  { label: 'Принято клиентом', value: 402, fill: '#0E9F6E' },
]

const productMix = [
  { name: 'Оборотный', share: 48, volume: 4.2 },
  { name: 'Инвестиц.', share: 27, volume: 6.8 },
  { name: 'Овердрафт', share: 15, volume: 0.9 },
  { name: 'Линия', share: 10, volume: 1.4 },
]

const topProducts = [
  { id: 'P-101', name: 'Бизнес-Оборот', apps: 412, takeUp: 54, avgTicket: '4.8 млн' },
  { id: 'P-103', name: 'Бизнес-Рост', apps: 218, takeUp: 41, avgTicket: '12.1 млн' },
  { id: 'P-102', name: 'Овердрафт Бизнес', apps: 186, takeUp: 61, avgTicket: '1.9 млн' },
  { id: 'P-104', name: 'Кредитная линия МСБ', apps: 124, takeUp: 38, avgTicket: '7.2 млн' },
]

const goalMix = [
  { goal: 'Оборот / закупка', pct: 36 },
  { goal: 'Кассовый разрыв', pct: 28 },
  { goal: 'Оборудование', pct: 18 },
  { goal: 'Новая точка', pct: 12 },
  { goal: 'Прочее', pct: 6 },
]

type AlertLevel = 'critical' | 'warning' | 'waiting'

const alerts: { level: AlertLevel; title: string; meta: string }[] = [
  {
    level: 'critical',
    title: 'Недоступна загрузка документов',
    meta: 'INC-2026-0412',
  },
  {
    level: 'warning',
    title: 'Дрифт скоринговой модели: PSI 0.11',
    meta: 'Мониторинг качества',
  },
  {
    level: 'waiting',
    title: 'Правило R-212 ожидает публикации',
    meta: 'Кредитная политика',
  },
]

const changes = [
  {
    when: 'Сегодня, 09:42',
    text: 'Политика v12 → v13: порог DSCR 1.15 → 1.20',
  },
  {
    when: 'Вчера, 18:05',
    text: 'Роль «Аналитик»: лимит согласования 15 → 20 млн ₽',
  },
  {
    when: '22 окт, 14:20',
    text: 'Каталог: обновлены ставки по оборотным продуктам',
  },
  {
    when: '21 окт, 11:08',
    text: 'Опубликовано правило R-208 (стоп-фактор по просрочке)',
  },
]

const alertChipSx: Record<AlertLevel, { label: string; bgcolor: string; color: string }> = {
  critical: {
    label: 'Критично',
    bgcolor: 'rgba(196,30,20,0.1)',
    color: color.semantic.error,
  },
  warning: {
    label: 'Внимание',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  waiting: {
    label: 'Ожидание',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
}

function envStamp(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function KpiCard({
  label,
  value,
  hint,
  trend,
  trendPositive,
  accent,
}: {
  label: string
  value: string
  hint?: string
  trend?: string
  trendPositive?: boolean
  accent?: boolean
}) {
  return (
    <Box
      sx={{
        ...tileSx,
        bgcolor: accent ? color.primary.soft06 : color.background.paper,
        borderColor: accent ? color.primary.soft20 : color.semantic.divider,
        p: 2,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: color.text.secondary, display: 'block', mb: 0.75, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5 }}>
        <Typography
          sx={{
            fontFamily: font.display,
            fontWeight: 750,
            fontSize: 26,
            letterSpacing: '-0.03em',
            color: color.text.primary,
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
        {trend && (
          <Typography
            sx={{
              fontSize: 12.5,
              fontWeight: 700,
              color: trendPositive ? color.semantic.success : color.semantic.error,
            }}
          >
            {trend}
          </Typography>
        )}
      </Stack>
      {hint && (
        <Typography variant="caption" sx={{ color: color.text.muted, display: 'block' }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}

export function AdminOverviewPage() {
  const maxFunnel = funnel[0]!.value

  return (
    <Box>
      <PageHeader
        title="Обзор системы"
        subtitle={`Линия решения · demo environment · ${envStamp()}`}
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
              Экспорт отчёта
            </Button>
            <Button
              variant="outlined"
              startIcon={<ReportProblemOutlinedIcon />}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Сообщить об инциденте
            </Button>
          </>
        }
      />

      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: color.text.inactive,
          mb: 1,
        }}
      >
        Операционные KPI
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Заявки (30 дн.)" value="1 284" trend="+8.2%" trendPositive />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Approval rate" value="62%" hint="частично 14%" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Время решения" value="1.4 дн." hint="цель ≤ 1.5" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Availability" value="99.94%" hint="за 30 дней" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Открытые алерты" value="3" hint="1 критичный" accent />
        </Grid>
      </Grid>

      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: color.text.inactive,
          mb: 1,
        }}
      >
        Продуктовые KPI
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Выдано (30 дн.)" value="13.3 млрд" trend="+5.1%" trendPositive />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Средний чек" value="5.4 млн" hint="медиана 3.2 млн" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Take-up rate" value="50%" hint="одобрено → принято" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Активных продуктов" value="4 / 6" hint="в подборе" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard label="Counteroffer share" value="14%" hint="принято 71%" />
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
                mb: 0.25,
                color: color.text.primary,
              }}
            >
              Заявки по неделям
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              ISO-недели · текущая неделя — незавершённая
            </Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyApps} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: color.secondary.soft03 }}
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                    formatter={(v: number) => [v, 'Заявки']}
                    labelFormatter={(l) => `Неделя ${l}`}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {weeklyApps.map((d) => (
                      <Cell
                        key={d.week}
                        fill={d.current ? color.secondary.main : color.primary.main}
                      />
                    ))}
                  </Bar>
                </BarChart>
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
                mb: 0.25,
                color: color.text.primary,
              }}
            >
              Воронка конвейера
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              Последние 30 дней
            </Typography>
            <Stack spacing={1.5}>
              {funnel.map((row) => (
                <Box key={row.label}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: color.text.primary }}>
                      {row.label}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: color.text.primary }}>
                      {row.value.toLocaleString('ru-RU')}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      height: 10,
                      borderRadius: `${radius.pill}px`,
                      bgcolor: color.secondary.soft06,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${(row.value / maxFunnel) * 100}%`,
                        bgcolor: row.fill,
                        borderRadius: `${radius.pill}px`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
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
              Микс продуктов
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              Доля заявок · объём выдач, млрд ₽
            </Typography>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productMix} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={color.secondary.soft06} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: color.text.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: color.text.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: radius.button,
                      border: `1px solid ${color.semantic.divider}`,
                      fontSize: 13,
                    }}
                    formatter={(v: number, name: string) => [
                      name === 'share' ? `${v}%` : `${v} млрд`,
                      name === 'share' ? 'Доля' : 'Объём',
                    ]}
                  />
                  <Bar dataKey="share" fill={color.primary.main} radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Grid>

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
              Топ продуктов
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 1.5 }}>
              По числу заявок за 30 дней
            </Typography>
            <Stack spacing={1}>
              {topProducts.map((p, i) => (
                <Box
                  key={p.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '28px 1fr 72px 72px 88px' },
                    gap: 1,
                    alignItems: 'center',
                    py: 1.1,
                    px: 1.25,
                    borderRadius: 2,
                    bgcolor: i === 0 ? color.primary.soft04 : color.secondary.soft03,
                    border: `1px solid ${color.semantic.divider}`,
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: color.text.muted }}>
                    #{i + 1}
                  </Typography>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: color.text.primary }}>
                      {p.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, fontFamily: font.mono, color: color.text.muted }}>
                      {p.id}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 650, textAlign: { sm: 'right' } }}>
                    {p.apps} заявок
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: color.text.secondary, textAlign: { sm: 'right' } }}>
                    take-up {p.takeUp}%
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: { sm: 'right' } }}>
                    {p.avgTicket}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
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
              Цели финансирования
            </Typography>
            <Typography variant="caption" sx={{ color: color.text.muted, display: 'block', mb: 2 }}>
              Структура заявок по цели
            </Typography>
            <Stack spacing={1.25}>
              {goalMix.map((g) => (
                <Box key={g.goal}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{g.goal}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{g.pct}%</Typography>
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
                        width: `${g.pct}%`,
                        height: '100%',
                        bgcolor: color.secondary.main,
                        borderRadius: `${radius.pill}px`,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                mb: 1.5,
                color: color.text.primary,
              }}
            >
              Портфельные ориентиры
            </Typography>
            <Grid container spacing={1.5}>
              {[
                { label: 'Отказы по DSCR', value: '34%', hint: 'доля среди отказов' },
                { label: 'Авто-решение', value: '41%', hint: 'без эскалации' },
                { label: 'Эскалация аналитику', value: '19%', hint: 'очередь рисков' },
                { label: 'Ср. ставка выдачи', value: '18.1%', hint: 'взвеш. по объёму' },
                { label: 'Документы дозапрос', value: '22%', hint: 'от поданных' },
                { label: 'SLA сегмент C', value: '44 ч', hint: 'время до решения' },
              ].map((c) => (
                <Grid key={c.label} size={{ xs: 6, sm: 4 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: color.secondary.soft03,
                      border: `1px solid ${color.semantic.divider}`,
                      height: '100%',
                    }}
                  >
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: color.text.muted, mb: 0.5 }}>
                      {c.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: font.display,
                        fontWeight: 750,
                        fontSize: 22,
                        letterSpacing: '-0.02em',
                        color: color.text.primary,
                        lineHeight: 1.15,
                      }}
                    >
                      {c.value}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: color.text.muted, mt: 0.35 }}>
                      {c.hint}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
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
              Требует внимания
            </Typography>
            <Stack spacing={1.25}>
              {alerts.map((a) => {
                const chip = alertChipSx[a.level]
                return (
                  <Box
                    key={a.meta}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: color.secondary.soft03,
                      border: `1px solid ${color.semantic.divider}`,
                    }}
                  >
                    <Chip
                      label={chip.label}
                      size="small"
                      sx={{
                        bgcolor: chip.bgcolor,
                        color: chip.color,
                        fontWeight: 700,
                        fontSize: 11,
                        height: 24,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: color.text.primary }}>
                        {a.title}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: color.text.muted, mt: 0.25 }}>
                        {a.meta}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
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
              Последние изменения
            </Typography>
            <Stack spacing={0} divider={undefined}>
              {changes.map((c, i) => (
                <Box
                  key={c.when}
                  sx={{
                    py: 1.35,
                    borderBottom:
                      i < changes.length - 1 ? `1px solid ${color.semantic.divider}` : 'none',
                  }}
                >
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: color.text.muted, mb: 0.35 }}>
                    {c.when}
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary, lineHeight: 1.4 }}>
                    {c.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>

    </Box>
  )
}
