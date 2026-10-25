import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

type NotifCategory = 'applications' | 'documents' | 'payments' | 'system'
type NotifKind = 'alert' | 'success' | 'doc' | 'time' | 'person'

type Notification = {
  id: string
  kind: NotifKind
  category: NotifCategory
  title: string
  body: string
  time: string
  unread: boolean
  href?: string
}

const INITIAL: Notification[] = [
  {
    id: 'n1',
    kind: 'alert',
    category: 'applications',
    title: 'Новое предложение по заявке ABC-2026-1042',
    body: '5 000 000 ₽ · 24 мес. · 18,5% · ответ до 27.10',
    time: '23.10 · 09:15',
    unread: true,
    href: '/app/applications/ABC-2026-1042/edit',
  },
  {
    id: 'n2',
    kind: 'success',
    category: 'documents',
    title: 'Договор аренды принят',
    body: 'Менеджер проверил документ — замечаний нет',
    time: '22.10 · 11:05',
    unread: true,
    href: '/app/documents',
  },
  {
    id: 'n3',
    kind: 'doc',
    category: 'documents',
    title: 'Запрос документов от менеджера',
    body: 'Нужны пояснение платежа и выписка за сентябрь',
    time: '21.10 · 12:20',
    unread: true,
    href: '/app/documents',
  },
  {
    id: 'n4',
    kind: 'time',
    category: 'payments',
    title: 'Скоро платёж 28.10',
    body: 'ABC-2026-0987 · 114 000 ₽',
    time: '21.10 · 08:00',
    unread: true,
    href: '/app/applications',
  },
  {
    id: 'n5',
    kind: 'success',
    category: 'documents',
    title: 'Выписка проанализирована',
    body: 'Найдено 2 замечания — посмотрите разбор',
    time: '22.10 · 10:30',
    unread: false,
    href: '/app/statements/analysis',
  },
  {
    id: 'n6',
    kind: 'person',
    category: 'system',
    title: 'Приглашение принято',
    body: 'Лебедева И.О. присоединилась к компании',
    time: '19.10 · 16:40',
    unread: false,
    href: '/app/team',
  },
  {
    id: 'n7',
    kind: 'success',
    category: 'applications',
    title: 'Заявка отправлена',
    body: 'ABC-2026-1042 принята в работу',
    time: '20.10 · 14:32',
    unread: false,
    href: '/app/applications',
  },
]

const KIND_META: Record<
  NotifKind,
  { bg: string; color: string; Icon: typeof CheckCircleRoundedIcon }
> = {
  alert: { bg: '#FDE8E6', color: '#EF3124', Icon: WarningAmberRoundedIcon },
  success: { bg: '#E6F5EE', color: '#1B8A5A', Icon: CheckCircleRoundedIcon },
  doc: { bg: '#EEF1F4', color: '#5A6B7D', Icon: DescriptionOutlinedIcon },
  time: { bg: '#FFF0E0', color: '#C45A12', Icon: AccessTimeRoundedIcon },
  person: { bg: '#EEF1F4', color: '#5A6B7D', Icon: PersonOutlineRoundedIcon },
}

type TabKey = 'all' | NotifCategory

export function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(INITIAL)

  if (user?.role === 'admin') {
    return <Navigate to="/app/admin/notifications" replace />
  }
  const [tab, setTab] = useState<TabKey>('all')
  const [channels, setChannels] = useState({
    push: true,
    email: true,
  })
  const [types, setTypes] = useState({
    appStatus: true,
    docRequests: true,
    payments: true,
    advice: false,
  })

  const unreadCount = items.filter((i) => i.unread).length

  const filtered = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((i) => i.category === tab)
  }, [items, tab])

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'all', label: 'Все', badge: unreadCount || undefined },
    { key: 'applications', label: 'Заявки' },
    { key: 'documents', label: 'Документы' },
    { key: 'payments', label: 'Платежи' },
    { key: 'system', label: 'Система' },
  ]

  function markAllRead() {
    setItems((list) => list.map((i) => ({ ...i, unread: false })))
  }

  function openItem(n: Notification) {
    setItems((list) => list.map((i) => (i.id === n.id ? { ...i, unread: false } : i)))
    if (n.href) navigate(n.href)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
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
            Уведомления
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            {unreadCount > 0 ? `${unreadCount} новых` : 'Все прочитаны'} · за последние 30 дней
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          disabled={unreadCount === 0}
          onClick={markAllRead}
          sx={{
            alignSelf: 'flex-start',
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            px: 2,
          }}
        >
          Отметить все прочитанными
        </Button>
      </Stack>

      <Stack
        direction="row"
        sx={{
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          mb: 2.5,
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              onClick={() => setTab(t.key)}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                px: 1.75,
                py: 1.15,
                fontSize: 14,
                fontWeight: 700,
                color: active ? '#0B1F35' : '#7A8795',
                borderBottom: active ? '2px solid #EF3124' : '2px solid transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                whiteSpace: 'nowrap',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <Box
                  component="span"
                  sx={{
                    minWidth: 20,
                    height: 20,
                    px: 0.55,
                    borderRadius: 999,
                    bgcolor: '#EF3124',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-grid',
                    placeItems: 'center',
                  }}
                >
                  {t.badge}
                </Box>
              )}
            </Box>
          )
        })}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(260px, 0.75fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.25}>
          {filtered.map((n) => {
            const meta = KIND_META[n.kind]
            const Icon = meta.Icon
            return (
              <Box
                key={n.id}
                component="button"
                type="button"
                onClick={() => openItem(n)}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'block',
                  boxSizing: 'border-box',
                  bgcolor: '#fff',
                  borderRadius: 3,
                  border: n.unread
                    ? '1px solid rgba(239,49,36,0.28)'
                    : '1px solid rgba(11,31,53,0.06)',
                  boxShadow: n.unread
                    ? '0 1px 10px rgba(239,49,36,0.06)'
                    : '0 1px 8px rgba(11,31,53,0.03)',
                  p: { xs: 1.5, md: 1.75 },
                  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                  '&:hover': {
                    borderColor: n.unread ? 'rgba(239,49,36,0.45)' : 'rgba(11,31,53,0.14)',
                    bgcolor: n.unread ? 'rgba(239,49,36,0.015)' : 'rgba(11,31,53,0.015)',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: meta.bg,
                      color: meta.color,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0, pt: 0.15 }}>
                    <Typography
                      sx={{
                        fontSize: 14.5,
                        fontWeight: n.unread ? 800 : 700,
                        color: '#0B1F35',
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {n.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: '#7A8795',
                        mt: 0.45,
                        lineHeight: 1.45,
                      }}
                    >
                      {n.body}
                    </Typography>
                  </Box>

                  <Stack
                    alignItems="flex-end"
                    spacing={0.75}
                    sx={{ flexShrink: 0, pt: 0.2, minWidth: 88 }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#9AA5B1',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.time}
                    </Typography>
                    {n.unread && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#EF3124',
                        }}
                      />
                    )}
                  </Stack>
                </Stack>
              </Box>
            )
          })}

          {filtered.length === 0 && (
            <Box sx={{ ...tileSx, textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                В этой категории пока нет уведомлений
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack spacing={2}>
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
              Каналы
            </Typography>
            <Stack spacing={0.25}>
              {(
                [
                  ['push', 'Push в приложении'],
                  ['email', 'E-mail'],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={channels[key]}
                      onChange={(_, v) => setChannels((c) => ({ ...c, [key]: v }))}
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#EF3124' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          bgcolor: '#EF3124',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                      {label}
                    </Typography>
                  }
                  sx={{
                    mx: 0,
                    justifyContent: 'space-between',
                    width: '100%',
                    ml: 0,
                    mr: 0,
                    flexDirection: 'row-reverse',
                  }}
                />
              ))}
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1.5, lineHeight: 1.4 }}>
              Тихие часы: 22:00–08:00
            </Typography>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              Типы уведомлений
            </Typography>
            <Stack spacing={0.15}>
              {(
                [
                  ['appStatus', 'Статус заявок'],
                  ['docRequests', 'Запросы документов'],
                  ['payments', 'Платежи и сроки'],
                  ['advice', 'Советы и рекомендации'],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={types[key]}
                      onChange={(_, v) => setTypes((t) => ({ ...t, [key]: v }))}
                      size="small"
                      sx={{
                        color: '#C5CCD3',
                        '&.Mui-checked': { color: '#EF3124' },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                      {label}
                    </Typography>
                  }
                  sx={{ mx: 0, ml: -0.5 }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
