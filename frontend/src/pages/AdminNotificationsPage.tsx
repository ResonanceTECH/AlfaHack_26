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
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded'
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/api/notifications'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 2, md: 2.25 },
} as const

type NotifCategory = 'incidents' | 'policy' | 'users' | 'models' | 'system'
type NotifKind = 'critical' | 'warning' | 'success' | 'policy' | 'user' | 'metric'

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

function adminNotifKind(n: AppNotification): NotifKind {
  const t = n.type.toUpperCase()
  if (t.includes('INCIDENT') || t.includes('CRITICAL') || t.includes('FAIL')) return 'critical'
  if (t.includes('POLICY') || t.includes('RULE')) return 'policy'
  if (t.includes('USER') || t.includes('ROLE') || t.includes('ACCESS')) return 'user'
  if (t.includes('MODEL') || t.includes('METRIC') || t.includes('DRIFT')) return 'metric'
  if (t.includes('WARN') || t.includes('SLA')) return 'warning'
  return 'success'
}

function adminNotifCategory(n: AppNotification): NotifCategory {
  const t = n.type.toUpperCase()
  if (t.includes('INCIDENT') || t.includes('SLA')) return 'incidents'
  if (t.includes('POLICY') || t.includes('RULE') || t.includes('CATALOG')) return 'policy'
  if (t.includes('USER') || t.includes('ROLE') || t.includes('ACCESS')) return 'users'
  if (t.includes('MODEL') || t.includes('DRIFT')) return 'models'
  return 'system'
}

function adminNotifHref(n: AppNotification): string | undefined {
  const t = n.type.toUpperCase()
  if (t.includes('POLICY') || t.includes('RULE')) return '/app/admin/policy'
  if (t.includes('USER') || t.includes('ROLE')) return '/app/admin/users'
  if (t.includes('AUDIT')) return '/app/admin/audit'
  if (t.includes('PRODUCT') || t.includes('CATALOG')) return '/app/admin/products'
  if (t.includes('MODEL') || t.includes('METRIC')) return '/app/admin/analytics'
  return '/app/admin'
}

function mapAdminItem(n: AppNotification): Notification {
  return {
    id: n.id,
    kind: adminNotifKind(n),
    category: adminNotifCategory(n),
    title: n.title,
    body: n.body,
    time: formatNotificationTime(n.createdAt),
    unread: !n.isRead,
    href: adminNotifHref(n),
  }
}

const KIND_META: Record<
  NotifKind,
  { bg: string; color: string; Icon: typeof CheckCircleRoundedIcon }
> = {
  critical: {
    bg: color.primary.soft08,
    color: color.primary.main,
    Icon: WarningAmberRoundedIcon,
  },
  warning: {
    bg: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
    Icon: WarningAmberRoundedIcon,
  },
  success: {
    bg: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
    Icon: CheckCircleRoundedIcon,
  },
  policy: {
    bg: color.secondary.soft06,
    color: color.secondary.main,
    Icon: PolicyRoundedIcon,
  },
  user: {
    bg: color.secondary.soft06,
    color: color.text.secondary,
    Icon: ManageAccountsRoundedIcon,
  },
  metric: {
    bg: color.primary.soft04,
    color: color.primary.main,
    Icon: InsightsRoundedIcon,
  },
}

type TabKey = 'all' | NotifCategory

export function AdminNotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('all')
  const [channels, setChannels] = useState({
    push: true,
    email: true,
    slack: true,
  })
  const [types, setTypes] = useState({
    incidents: true,
    policy: true,
    users: true,
    models: true,
    productKpis: true,
  })

  const listQ = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications({ limit: 50 }),
  })
  const items = useMemo(
    () => (listQ.data?.items ?? []).map(mapAdminItem),
    [listQ.data],
  )
  const unreadCount = listQ.data?.unreadCount ?? items.filter((i) => i.unread).length

  const markAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const markOneMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const filtered = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((i) => i.category === tab)
  }, [items, tab])

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'all', label: 'Все', badge: unreadCount || undefined },
    { key: 'incidents', label: 'Инциденты' },
    { key: 'policy', label: 'Политика' },
    { key: 'users', label: 'Доступ' },
    { key: 'models', label: 'Модели' },
    { key: 'system', label: 'Система' },
  ]

  function markAllRead() {
    markAllMut.mutate()
  }

  function openItem(n: Notification) {
    if (n.unread) markOneMut.mutate(n.id)
    if (n.href) navigate(n.href)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 2 }}>
      <PageHeader
        title="Уведомления администратора"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} новых · инциденты, политика, доступ и KPI`
            : 'Все прочитаны · инциденты, политика, доступ и KPI'
        }
        actions={
          <Button
            variant="outlined"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            sx={{
              borderColor: color.secondary.soft08,
              color: color.text.primary,
              bgcolor: color.background.paper,
              borderRadius: `${radius.button}px`,
              fontWeight: 600,
            }}
          >
            Отметить все прочитанными
          </Button>
        }
      />

      <Stack
        direction="row"
        sx={{
          borderBottom: `1px solid ${color.semantic.divider}`,
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
                color: active ? color.text.primary : color.text.muted,
                borderBottom: active
                  ? `2px solid ${color.primary.main}`
                  : '2px solid transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                whiteSpace: 'nowrap',
                '&:hover': { color: color.text.primary },
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
                    bgcolor: color.primary.main,
                    color: color.text.onDark,
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
                  bgcolor: color.background.paper,
                  borderRadius: 3,
                  border: n.unread
                    ? `1px solid ${color.primary.soft20}`
                    : `1px solid ${color.semantic.divider}`,
                  boxShadow: n.unread
                    ? '0 1px 10px rgba(239,49,36,0.06)'
                    : shadow.paper1,
                  p: { xs: 1.5, md: 1.75 },
                  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                  '&:hover': {
                    borderColor: n.unread ? color.primary.light : 'rgba(11,31,53,0.14)',
                    bgcolor: n.unread ? color.primary.soft04 : color.secondary.soft03,
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
                        fontFamily: font.display,
                        color: color.text.primary,
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {n.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: color.text.muted,
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
                        color: color.text.inactive,
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
                          bgcolor: color.primary.main,
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
              <Typography sx={{ color: color.text.inactive, fontSize: 14 }}>
                В этой категории пока нет уведомлений
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <MonitorHeartRoundedIcon sx={{ fontSize: 18, color: color.primary.main }} />
              <Typography
                sx={{
                  fontFamily: font.display,
                  fontWeight: 800,
                  fontSize: 16,
                  color: color.text.primary,
                }}
              >
                Каналы оповещения
              </Typography>
            </Stack>
            <Stack spacing={0.25}>
              {(
                [
                  ['push', 'Push в кабинете'],
                  ['email', 'E-mail on-call'],
                  ['slack', 'Slack #credit-ops'],
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
                        '& .MuiSwitch-switchBase.Mui-checked': { color: color.primary.main },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          bgcolor: color.primary.main,
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: color.text.primary }}>
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
            <Typography sx={{ fontSize: 12, color: color.text.inactive, mt: 1.5, lineHeight: 1.4 }}>
              Критичные инциденты всегда обходят тихие часы
            </Typography>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: 16,
                color: color.text.primary,
                mb: 1.25,
              }}
            >
              Типы событий
            </Typography>
            <Stack spacing={0.15}>
              {(
                [
                  ['incidents', 'Инциденты и availability'],
                  ['policy', 'Политика и каталог'],
                  ['users', 'Блокировки и смена ролей'],
                  ['models', 'Дрифт и качество моделей'],
                  ['productKpis', 'Продуктовые KPI / SLA'],
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
                        color: color.text.inactive,
                        '&.Mui-checked': { color: color.primary.main },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: color.text.primary }}>
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
