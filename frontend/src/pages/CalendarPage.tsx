import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import { useMemo, useState, type ReactNode } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/hooks/useAppStore'
import { createObligation } from '@/api/companies'

const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]
const MONTHS_RU_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const DEMO_CURSOR = dayjs('2026-11-01')
const DEMO_SELECTED = '2026-11-23'

type Tone = 'gray' | 'orange' | 'pink' | 'green'
type IconKind = 'warn' | 'docs' | 'pay' | 'clock'

type CalEvent = {
  id: string
  title: string
  chip: string
  date: string
  amount?: number
  tone: Tone
  icon: IconKind
  detail?: string
  badge?: string
  badgeTone?: 'red' | 'amber'
  upcomingOnly?: boolean
}

const DEMO_EVENTS: CalEvent[] = [
  {
    id: 'd_rent',
    title: 'Аренда',
    chip: 'Аренда 238 000 ₽',
    date: '2026-11-05',
    amount: 238_000,
    tone: 'gray',
    icon: 'pay',
  },
  {
    id: 'd_fot',
    title: 'Аванс ФОТ',
    chip: 'Аванс ФОТ',
    date: '2026-11-10',
    amount: 0,
    tone: 'gray',
    icon: 'pay',
  },
  {
    id: 'd_usn',
    title: 'Аванс по УСН',
    chip: 'УСН: аванс',
    date: '2026-11-25',
    amount: 310_000,
    tone: 'orange',
    icon: 'pay',
    detail: undefined,
  },
  {
    id: 'd_reply',
    title: 'Ответ на предложение банка',
    chip: 'Ответ банку',
    date: '2026-11-27',
    tone: 'pink',
    icon: 'warn',
    detail: 'ABC-2026-1042',
    badge: '4 дня',
    badgeTone: 'red',
  },
  {
    id: 'd_pay',
    title: 'Платёж АВС-2026-0987',
    chip: 'Платёж 114 000 ₽',
    date: '2026-11-28',
    amount: 114_000,
    tone: 'green',
    icon: 'pay',
    detail: '114 000 ₽',
  },
  {
    id: 'd_tax',
    title: 'Налоги',
    chip: 'Налоги',
    date: '2026-11-30',
    amount: 0,
    tone: 'gray',
    icon: 'pay',
  },
  {
    id: 'd_docs',
    title: 'Загрузить документы',
    chip: 'Документы',
    date: '2026-10-25',
    tone: 'orange',
    icon: 'docs',
    detail: 'запрос менеджера',
    badge: '2 дня',
    badgeTone: 'amber',
    upcomingOnly: true,
  },
  {
    id: 'd_reply_oct',
    title: 'Ответ на предложение банка',
    chip: 'Ответ банку',
    date: '2026-10-27',
    tone: 'pink',
    icon: 'warn',
    detail: 'ABC-2026-1042',
    badge: '4 дня',
    badgeTone: 'red',
    upcomingOnly: true,
  },
  {
    id: 'd_pay_oct',
    title: 'Платёж АВС-2026-0987',
    chip: 'Платёж 114 000 ₽',
    date: '2026-10-28',
    amount: 114_000,
    tone: 'green',
    icon: 'pay',
    detail: '114 000 ₽',
    upcomingOnly: true,
  },
  {
    id: 'd_new_credit',
    title: 'Первый платёж по новому кредиту',
    chip: 'Новый кредит',
    date: '2026-11-28',
    amount: 154_000,
    tone: 'gray',
    icon: 'clock',
    detail: '≈ 154 000 ₽ · после подписания',
    upcomingOnly: true,
  },
]

const DEMO_UPCOMING_ORDER = [
  'd_reply_oct',
  'd_docs',
  'd_pay_oct',
  'd_usn',
  'd_new_credit',
]

function chipColors(tone: Tone) {
  switch (tone) {
    case 'orange':
      return { bg: '#FFF0E0', fg: '#C45A12' }
    case 'pink':
      return { bg: '#FDE8E6', fg: '#D32F2F' }
    case 'green':
      return { bg: '#E4F5EC', fg: '#1B7A4A' }
    default:
      return { bg: '#EEF1F4', fg: '#5C6B7A' }
  }
}

function money(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

function buildMonthCells(cursor: Dayjs) {
  const start = cursor.startOf('month')
  const end = cursor.endOf('month')
  const startPad = (start.day() + 6) % 7
  const gridStart = start.subtract(startPad, 'day')
  const cells: Dayjs[] = []
  for (let i = 0; i < 42; i++) cells.push(gridStart.add(i, 'day'))
  if (cells[35]!.isAfter(end, 'day')) return cells.slice(0, 35)
  return cells
}

function EventIcon({ kind }: { kind: IconKind }) {
  const wrap = (bg: string, color: string, child: ReactNode) => (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        bgcolor: bg,
        color,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {child}
    </Box>
  )
  if (kind === 'warn')
    return wrap('#FDE8E6', '#EF3124', <WarningAmberRoundedIcon sx={{ fontSize: 20 }} />)
  if (kind === 'docs')
    return wrap('#EEF1F4', '#5C6B7A', <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />)
  if (kind === 'clock')
    return wrap('#EEF1F4', '#5C6B7A', <AccessTimeRoundedIcon sx={{ fontSize: 18 }} />)
  return wrap(
    '#EEF1F4',
    '#0B1F35',
    <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>P</Typography>,
  )
}

function downloadIcs(events: CalEvent[], filename: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liniya Resheniya//Calendar//RU',
    'CALSCALE:GREGORIAN',
  ]
  for (const e of events.filter((x) => !x.upcomingOnly)) {
    const d = e.date.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@liniya-resheniya`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${e.title.replace(/,/g, '\\,')}`,
      e.amount != null ? `DESCRIPTION:${money(e.amount)}` : 'DESCRIPTION:',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CalendarPage() {
  const { obligations, companyId } = useAppStore()
  const qc = useQueryClient()
  const [cursor, setCursor] = useState(() => DEMO_CURSOR)
  const [selected, setSelected] = useState(DEMO_SELECTED)
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(50_000)
  const [dueDate, setDueDate] = useState('2026-11-15')
  const [type, setType] = useState('supplier')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const liveEvents = useMemo((): CalEvent[] => {
    return obligations
      .filter((o) => o.status !== 'paid')
      .map((o) => {
        const tone: Tone =
          o.type === 'tax' ? 'orange' : o.type === 'loan' ? 'green' : 'gray'
        return {
          id: o.id,
          title: o.title,
          chip:
            o.amount > 0
              ? `${o.title.length > 16 ? o.title.slice(0, 14) + '…' : o.title} ${money(o.amount)}`
              : o.title,
          date: o.dueDate,
          amount: o.amount,
          tone,
          icon: 'pay' as const,
          detail: o.amount ? money(o.amount) : undefined,
        }
      })
  }, [obligations])

  const calendarEvents = useMemo(() => {
    const demoGrid = DEMO_EVENTS.filter((e) => !e.upcomingOnly)
    const ids = new Set(liveEvents.map((e) => e.date + e.title))
    const merged = [
      ...demoGrid,
      ...liveEvents.filter((e) => !ids.has(e.date + e.title) && !demoGrid.some((d) => d.id === e.id)),
    ]
    return merged
  }, [liveEvents])

  const cells = useMemo(() => buildMonthCells(cursor), [cursor])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of calendarEvents) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [calendarEvents])

  const upcoming = useMemo(() => {
    const byId = new Map(DEMO_EVENTS.map((e) => [e.id, e]))
    const demoList = DEMO_UPCOMING_ORDER.map((id) => byId.get(id)!).filter(Boolean)
    if (liveEvents.length === 0) return demoList
    const today = dayjs('2026-10-23')
    const liveUp = liveEvents
      .filter((e) => !dayjs(e.date).isBefore(today, 'day'))
      .slice(0, 2)
    return [...demoList.slice(0, 3), ...liveUp].slice(0, 5)
  }, [liveEvents])

  async function addEvent() {
    if (!title.trim() || !companyId) return
    setSaving(true)
    setError(null)
    try {
      await createObligation({
        companyId,
        type,
        title: title.trim(),
        amount,
        dueDate,
        recurring: false,
        status: 'planned',
      })
      await qc.invalidateQueries({ queryKey: ['obligations', companyId] })
      setAddOpen(false)
      setTitle('')
      setCursor(dayjs(dueDate).startOf('month'))
      setSelected(dueDate)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить событие')
    } finally {
      setSaving(false)
    }
  }

  const monthCap = `${MONTHS_RU[cursor.month()]!.charAt(0).toUpperCase()}${MONTHS_RU[cursor.month()]!.slice(1)} ${cursor.year()}`
  const monthGen = MONTHS_RU_GEN[cursor.month()]!

  const outlineBtn = {
    borderRadius: 2,
    borderColor: 'rgba(11,31,53,0.14)',
    color: '#0B1F35',
    fontWeight: 600,
    fontSize: 13.5,
    bgcolor: '#fff',
    px: 2,
    py: 0.85,
    textTransform: 'none' as const,
    boxShadow: 'none',
    '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 1 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
            Финансовый календарь
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            Платежи по кредитам, налоги и сроки по заявкам
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button variant="outlined" onClick={() => setAddOpen(true)} sx={outlineBtn}>
            Добавить событие
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              downloadIcs(calendarEvents, `alfa-calendar-${cursor.format('YYYY-MM')}.ics`)
            }
            sx={outlineBtn}
          >
            Экспорт в .ics
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.65fr) minmax(280px, 0.88fr)' },
          alignItems: 'start',
        }}
      >
        {/* ——— Calendar ——— */}
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(11,31,53,0.06)',
            boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
            p: { xs: 1.75, md: 2.25 },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 17,
                color: '#0B1F35',
              }}
            >
              {monthCap}
            </Typography>
            <Stack direction="row" spacing={0.75}>
              <IconButton
                size="small"
                onClick={() => setCursor((c) => c.subtract(1, 'month'))}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(11,31,53,0.1)',
                  borderRadius: 1.5,
                  color: '#0B1F35',
                }}
              >
                <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setCursor((c) => c.add(1, 'month'))}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(11,31,53,0.1)',
                  borderRadius: 1.5,
                  color: '#0B1F35',
                }}
              >
                <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: '6px',
              mb: '6px',
            }}
          >
            {WEEKDAYS.map((d) => (
              <Typography
                key={d}
                sx={{
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#9AA5B1',
                  py: 0.35,
                }}
              >
                {d}
              </Typography>
            ))}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: '6px',
            }}
          >
            {cells.map((day) => {
              const key = day.format('YYYY-MM-DD')
              const inMonth = day.isSame(cursor, 'month')
              const isSelected = key === selected
              const dayEvents = (eventsByDay.get(key) ?? []).slice(0, 2)
              return (
                <Box
                  key={key}
                  onClick={() => setSelected(key)}
                  sx={{
                    minHeight: { xs: 68, md: 92 },
                    borderRadius: 2,
                    p: '6px 7px',
                    cursor: 'pointer',
                    bgcolor: isSelected
                      ? 'rgba(239,49,36,0.05)'
                      : inMonth
                        ? '#fff'
                        : '#F5F6F8',
                    border: isSelected
                      ? '1.5px solid #EF3124'
                      : '1px solid rgba(11,31,53,0.07)',
                    opacity: inMonth ? 1 : 0.65,
                    transition: 'border-color 0.12s, background 0.12s',
                    '&:hover': {
                      borderColor: isSelected ? '#EF3124' : 'rgba(11,31,53,0.18)',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? '#EF3124' : inMonth ? '#0B1F35' : '#9AA5B1',
                      mb: 0.55,
                      lineHeight: 1,
                    }}
                  >
                    {day.date()}
                  </Typography>
                  <Stack spacing="3px">
                    {dayEvents.map((ev) => {
                      const c = chipColors(ev.tone)
                      return (
                        <Box
                          key={ev.id}
                          title={ev.title}
                          sx={{
                            px: '5px',
                            py: '2px',
                            borderRadius: '4px',
                            bgcolor: c.bg,
                            color: c.fg,
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ev.chip}
                        </Box>
                      )
                    })}
                  </Stack>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* ——— Right column ——— */}
        <Stack spacing={2}>
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 3,
              border: '1px solid rgba(11,31,53,0.06)',
              boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
              p: 2.25,
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.75,
              }}
            >
              Ближайшие события
            </Typography>
            <Stack spacing={0}>
              {upcoming.map((e, i) => (
                <Stack
                  key={e.id}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                  sx={{
                    py: 1.2,
                    borderBottom: i < upcoming.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                  }}
                >
                  <EventIcon kind={e.icon} />
                  <Box sx={{ flex: 1, minWidth: 0, pt: 0.15 }}>
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0B1F35',
                        lineHeight: 1.3,
                      }}
                    >
                      {e.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.3 }}>
                      {dayjs(e.date).format('DD.MM')}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </Typography>
                  </Box>
                  {e.badge && (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        bgcolor: e.badgeTone === 'red' ? '#FDE8E6' : '#FFF0E0',
                        color: e.badgeTone === 'red' ? '#EF3124' : '#C45A12',
                      }}
                    >
                      {e.badge}
                    </Box>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 3,
              border: '1px solid rgba(11,31,53,0.06)',
              boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
              p: 2.25,
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.75,
              }}
            >
              Платежи за {MONTHS_RU[cursor.month()]}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: 2,
                rowGap: 1.75,
                mb: 2.25,
              }}
            >
              <Stat label="По кредитам" value="114 000 ₽" />
              <Stat label="Новый кредит (с нояб.)" value="≈ 154 000 ₽" />
              <Stat label="Налоги и взносы" value="≈ 310 000 ₽" />
              <Stat label="Итого" value="≈ 578 000 ₽" accent />
            </Box>

            <Typography sx={{ fontSize: 12.5, color: '#7A8795', mb: 1 }}>
              Доля от прогноза выручки {monthGen}: 37%
            </Typography>
            <Box
              sx={{
                height: 8,
                borderRadius: 999,
                bgcolor: '#E8EBEE',
                overflow: 'hidden',
                mb: 2.25,
              }}
            >
              <Box
                sx={{
                  width: '37%',
                  height: '100%',
                  bgcolor: '#EF3124',
                  borderRadius: 999,
                }}
              />
            </Box>
            <Button
              fullWidth
              variant="outlined"
              sx={{ ...outlineBtn, py: 1.05 }}
              onClick={() => setAddOpen(true)}
            >
              Настроить напоминания
            </Button>
          </Box>
        </Stack>
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          Добавить событие
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Название"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <TextField
              select
              label="Тип"
              fullWidth
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                ['rent', 'Аренда'],
                ['salary', 'ФОТ'],
                ['tax', 'Налоги'],
                ['supplier', 'Поставщик'],
                ['loan', 'Кредит'],
                ['other', 'Другое'],
              ].map(([v, l]) => (
                <MenuItem key={v} value={v}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="number"
                label="Сумма, ₽"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <TextField
                type="date"
                label="Дата"
                fullWidth
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ fontWeight: 600, color: '#5A6B7D' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={saving || !title.trim()}
            onClick={() => void addEvent()}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            {saving ? '…' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 0.35, lineHeight: 1.3 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 750,
          color: accent ? '#EF3124' : '#0B1F35',
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}
