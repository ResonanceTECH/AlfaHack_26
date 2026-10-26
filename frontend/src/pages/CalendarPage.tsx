import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '@/api/errors'
import { useAppStore } from '@/hooks/useAppStore'
import {
  createObligation,
  downloadCompanyCalendarIcs,
  getCalendarReminderSettings,
  patchCalendarReminderSettings,
  type CalendarReminderSettings,
} from '@/api/companies'

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

const REMINDER_DAY_OPTIONS = [0, 1, 3, 7, 14]
const REMINDER_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: 'loan', label: 'Кредиты' },
  { id: 'tax', label: 'Налоги' },
  { id: 'rent', label: 'Аренда' },
  { id: 'salary', label: 'ФОТ' },
  { id: 'supplier', label: 'Поставщики' },
  { id: 'task', label: 'Задачи команды' },
  { id: 'other', label: 'Другое' },
]

export function CalendarPage() {
  const { obligations, companyId, financials } = useAppStore()
  const qc = useQueryClient()
  const [cursor, setCursor] = useState(() => dayjs().startOf('month'))
  const [selected, setSelected] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [addOpen, setAddOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(50_000)
  const [dueDate, setDueDate] = useState(() => dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [type, setType] = useState('supplier')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [icsBusy, setIcsBusy] = useState(false)
  const [remindDraft, setRemindDraft] = useState<CalendarReminderSettings | null>(null)
  const [remindSaving, setRemindSaving] = useState(false)

  const remindQ = useQuery({
    queryKey: ['calendar', 'reminder-settings', companyId],
    queryFn: () => getCalendarReminderSettings(companyId!),
    enabled: Boolean(companyId) && remindOpen,
  })

  useEffect(() => {
    if (remindQ.data) setRemindDraft(remindQ.data)
  }, [remindQ.data])

  const calendarEvents = useMemo((): CalEvent[] => {
    const today = dayjs().startOf('day')
    return obligations
      .filter((o) => {
        const st = String(o.status ?? '').toLowerCase()
        return st !== 'paid' && st !== 'cancelled' && st !== 'canceled'
      })
      .map((o) => {
        const tone: Tone =
          o.type === 'tax' || o.type === 'task'
            ? 'orange'
            : o.type === 'loan'
              ? 'green'
              : 'gray'
        const due = dayjs(o.dueDate)
        const daysLeft = due.diff(today, 'day')
        let badge: string | undefined
        let badgeTone: 'red' | 'amber' | undefined
        if (daysLeft < 0) {
          badge = 'просрочено'
          badgeTone = 'red'
        } else if (daysLeft <= 2) {
          badge = daysLeft === 0 ? 'сегодня' : `${daysLeft} дн.`
          badgeTone = 'red'
        } else if (daysLeft <= 7) {
          badge = `${daysLeft} дн.`
          badgeTone = 'amber'
        }
        const short =
          o.title.length > 14 ? `${o.title.slice(0, 12)}…` : o.title
        return {
          id: o.id,
          title: o.title,
          chip: o.amount > 0 ? `${short} ${money(o.amount)}` : short,
          date: o.dueDate.slice(0, 10),
          amount: o.amount,
          tone,
          icon: (o.type === 'task' ? 'docs' : 'pay') as IconKind,
          detail: o.amount > 0 ? money(o.amount) : o.type === 'task' ? 'задача' : undefined,
          badge,
          badgeTone,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [obligations])

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
    const today = dayjs().startOf('day')
    return calendarEvents
      .filter((e) => !dayjs(e.date).isBefore(today, 'day'))
      .slice(0, 6)
  }, [calendarEvents])

  const monthEvents = useMemo(
    () => calendarEvents.filter((e) => dayjs(e.date).isSame(cursor, 'month')),
    [calendarEvents, cursor],
  )

  const monthStats = useMemo(() => {
    const loan = monthEvents
      .filter((e) => e.tone === 'green' || (e.detail && e.title.toLowerCase().includes('кредит')))
      .reduce((s, e) => s + (e.amount ?? 0), 0)
    const tax = monthEvents
      .filter((e) => e.tone === 'orange' && !e.title.toLowerCase().includes('задач'))
      .reduce((s, e) => s + (e.amount ?? 0), 0)
    const other = monthEvents.reduce((s, e) => s + (e.amount ?? 0), 0)
    const byTypeLoan = monthEvents
      .filter((e) => {
        const o = obligations.find((x) => x.id === e.id)
        return o?.type === 'loan'
      })
      .reduce((s, e) => s + (e.amount ?? 0), 0)
    const byTypeTax = monthEvents
      .filter((e) => obligations.find((x) => x.id === e.id)?.type === 'tax')
      .reduce((s, e) => s + (e.amount ?? 0), 0)
    const total = other
    return {
      loan: byTypeLoan || loan,
      tax: byTypeTax || tax,
      total,
    }
  }, [monthEvents, obligations])

  const revenueShare = useMemo(() => {
    const rev = financials?.avgMonthlyRevenue ?? 0
    if (!rev || rev <= 0) return null
    return Math.min(100, Math.round((monthStats.total / rev) * 100))
  }, [financials, monthStats.total])

  async function downloadEventIcs(obligationId: string) {
    if (!companyId) return
    setIcsBusy(true)
    setError(null)
    try {
      await downloadCompanyCalendarIcs(companyId, { obligationId })
    } catch (e) {
      setError(apiErrorMessage(e, 'Не удалось скачать .ics'))
    } finally {
      setIcsBusy(false)
    }
  }

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
      setError(apiErrorMessage(e, 'Не удалось добавить событие'))
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
            disabled={!companyId || icsBusy}
            onClick={() => {
              if (!companyId) return
              setIcsBusy(true)
              setError(null)
              void downloadCompanyCalendarIcs(companyId, { month: cursor.format('YYYY-MM') })
                .catch((e) =>
                  setError(e instanceof Error ? e.message : 'Не удалось скачать .ics'),
                )
                .finally(() => setIcsBusy(false))
            }}
            sx={outlineBtn}
          >
            {icsBusy ? '…' : 'Экспорт в .ics'}
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
              const allDay = eventsByDay.get(key) ?? []
              const dayEvents = allDay.slice(0, 2)
              const more = allDay.length - dayEvents.length
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
                          component="button"
                          type="button"
                          title={`${ev.title} — скачать .ics`}
                          disabled={!companyId || icsBusy}
                          onClick={(e) => {
                            e.stopPropagation()
                            void downloadEventIcs(ev.id)
                          }}
                          sx={{
                            all: 'unset',
                            boxSizing: 'border-box',
                            display: 'block',
                            width: '100%',
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
                            cursor: 'pointer',
                            '&:hover': { filter: 'brightness(0.96)' },
                          }}
                        >
                          {ev.chip}
                        </Box>
                      )
                    })}
                    {more > 0 && (
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#9AA5B1', pl: '2px' }}>
                        +{more}
                      </Typography>
                    )}
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
              {upcoming.length === 0 && (
                <Typography sx={{ color: '#9AA5B1', fontSize: 13.5, py: 1 }}>
                  Нет предстоящих событий — добавьте платёж или задачу
                </Typography>
              )}
              {upcoming.map((e, i) => (
                <Stack
                  key={e.id}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                  onClick={() => {
                    if (!companyId) return
                    void downloadEventIcs(e.id)
                  }}
                  sx={{
                    py: 1.2,
                    borderBottom: i < upcoming.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                    cursor: companyId ? 'pointer' : 'default',
                    borderRadius: 1,
                    '&:hover': companyId ? { bgcolor: 'rgba(11,31,53,0.03)' } : undefined,
                  }}
                  title="Скачать .ics"
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
                      {' · .ics'}
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
              <Stat label="По кредитам" value={money(monthStats.loan)} />
              <Stat label="Событий в месяце" value={String(monthEvents.length)} />
              <Stat label="Налоги и взносы" value={money(monthStats.tax)} />
              <Stat label="Итого" value={money(monthStats.total)} accent />
            </Box>

            <Typography sx={{ fontSize: 12.5, color: '#7A8795', mb: 1 }}>
              {revenueShare != null
                ? `Доля от прогноза выручки ${monthGen}: ${revenueShare}%`
                : `Сумма обязательств ${monthGen}`}
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
                  width: `${revenueShare ?? Math.min(100, monthEvents.length * 12)}%`,
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
              onClick={() => setRemindOpen(true)}
            >
              Настроить напоминания
            </Button>
          </Box>
        </Stack>
      </Box>

      <Dialog open={remindOpen} onClose={() => setRemindOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          Напоминания
        </DialogTitle>
        <DialogContent>
          {remindQ.isLoading && !remindDraft && (
            <Typography sx={{ color: '#7A8795', fontSize: 14, py: 2 }}>Загрузка…</Typography>
          )}
          {remindDraft && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={remindDraft.enabled}
                    onChange={(e) =>
                      setRemindDraft({ ...remindDraft, enabled: e.target.checked })
                    }
                  />
                }
                label="Включить напоминания"
              />
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35', mb: 1 }}>
                  За сколько дней
                </Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                  {REMINDER_DAY_OPTIONS.map((d) => {
                    const on = remindDraft.daysBefore.includes(d)
                    return (
                      <FormControlLabel
                        key={d}
                        control={
                          <Checkbox
                            size="small"
                            checked={on}
                            onChange={() => {
                              const next = on
                                ? remindDraft.daysBefore.filter((x) => x !== d)
                                : [...remindDraft.daysBefore, d].sort((a, b) => b - a)
                              setRemindDraft({ ...remindDraft, daysBefore: next })
                            }}
                          />
                        }
                        label={d === 0 ? 'В день платежа' : `За ${d} дн.`}
                      />
                    )
                  })}
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35', mb: 1 }}>
                  Типы событий
                </Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                  {REMINDER_TYPE_OPTIONS.map((t) => {
                    const on = remindDraft.types.includes(t.id)
                    return (
                      <FormControlLabel
                        key={t.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={on}
                            onChange={() => {
                              const next = on
                                ? remindDraft.types.filter((x) => x !== t.id)
                                : [...remindDraft.types, t.id]
                              setRemindDraft({ ...remindDraft, types: next })
                            }}
                          />
                        }
                        label={t.label}
                      />
                    )
                  })}
                </Stack>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: '#7A8795', lineHeight: 1.45 }}>
                Настройки попадут в VALARM при экспорте .ics и в in-app уведомления
                (OBLIGATION_DUE).
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRemindOpen(false)} sx={{ fontWeight: 600, color: '#5A6B7D' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!companyId || !remindDraft || remindSaving}
            onClick={() => {
              if (!companyId || !remindDraft) return
              setRemindSaving(true)
              void patchCalendarReminderSettings(companyId, remindDraft)
                .then(async (saved) => {
                  setRemindDraft(saved)
                  await qc.invalidateQueries({
                    queryKey: ['calendar', 'reminder-settings', companyId],
                  })
                  setRemindOpen(false)
                })
                .catch((e) =>
                  setError(e instanceof Error ? e.message : 'Не удалось сохранить настройки'),
                )
                .finally(() => setRemindSaving(false))
            }}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            {remindSaving ? '…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

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
