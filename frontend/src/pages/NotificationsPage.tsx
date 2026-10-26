import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '@/api/errors'
import {
  formatNotificationTime,
  inviteMetaFromNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationCategory,
  notificationHref,
  notificationKind,
  type AppNotification,
} from '@/api/notifications'
import { acceptInvite, declineInvite, listMyInvites } from '@/api/team'
import { useAuth } from '@/contexts/AuthContext'
import { isAnalystRole } from '@/features/analyst/roles'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

type EntrepreneurCategory = 'applications' | 'documents' | 'payments' | 'system'
type AnalystCategory = 'queue' | 'sla' | 'documents' | 'system'
type NotifKind = 'alert' | 'success' | 'doc' | 'time' | 'person' | 'queue'

type Notification = {
  id: string
  kind: NotifKind
  category: EntrepreneurCategory | AnalystCategory
  title: string
  body: string
  time: string
  unread: boolean
  href?: string
  inviteCode?: string
  inviteId?: string
  inviteCompanyId?: string
  /** Live code from /invites/mine (stale notification payloads are remapped). */
  liveInviteCode?: string
}

const KIND_META: Record<
  NotifKind,
  { bg: string; color: string; Icon: typeof CheckCircleRoundedIcon }
> = {
  alert: { bg: '#FDE8E6', color: '#EF3124', Icon: WarningAmberRoundedIcon },
  success: { bg: '#E6F5EE', color: '#1B8A5A', Icon: CheckCircleRoundedIcon },
  doc: { bg: '#EEF1F4', color: '#5A6B7D', Icon: DescriptionOutlinedIcon },
  time: { bg: '#FFF0E0', color: '#C45A12', Icon: AccessTimeRoundedIcon },
  person: { bg: '#EEF1F4', color: '#5A6B7D', Icon: PersonOutlineRoundedIcon },
  queue: { bg: '#EEF1F4', color: '#0B1F35', Icon: AssignmentRoundedIcon },
}

type TabKey = 'all' | EntrepreneurCategory | AnalystCategory

function mapItem(n: AppNotification, analyst: boolean): Notification {
  const invite = inviteMetaFromNotification(n)
  return {
    id: n.id,
    kind: notificationKind(n),
    category: notificationCategory(n, analyst) as EntrepreneurCategory | AnalystCategory,
    title: n.title,
    body: n.body,
    time: formatNotificationTime(n.createdAt),
    unread: !n.isRead,
    href: notificationHref(n, analyst ? 'analyst' : 'entrepreneur'),
    inviteCode: invite.code,
    inviteId: invite.inviteId,
    inviteCompanyId: invite.companyId,
  }
}

export function NotificationsPage() {
  const { user, selectCompany } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const analyst = isAnalystRole(user?.role)

  const listQ = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications({ limit: 50 }),
  })
  const myInvitesQ = useQuery({
    queryKey: ['team', 'invites', 'mine'],
    queryFn: listMyInvites,
    enabled: !analyst,
  })

  const markAllM = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const [inviteActionError, setInviteActionError] = useState<string | null>(null)

  const inviteActionM = useMutation({
    mutationFn: async ({
      code,
      action,
      companyId,
    }: {
      code: string
      action: 'accept' | 'decline'
      companyId?: string
    }) => {
      // Only live codes from /invites/mine reach here (actionableCode).
      if (action === 'accept') return acceptInvite(code, { companyId })
      await declineInvite(code)
      return undefined
    },
    retry: false,
    onSuccess: async (res) => {
      setInviteActionError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['team'] }),
        qc.invalidateQueries({ queryKey: ['companies'] }),
        qc.invalidateQueries({ queryKey: ['team', 'invites', 'mine'] }),
      ])
      if (res?.companyId) {
        selectCompany(res.companyId)
        navigate('/app/team')
      }
    },
    onError: (err) => setInviteActionError(apiErrorMessage(err, 'Не удалось обработать приглашение')),
  })

  const [tab, setTab] = useState<TabKey>('all')
  const [channels, setChannels] = useState({
    push: true,
    email: true,
  })
  const [entrepreneurTypes, setEntrepreneurTypes] = useState({
    appStatus: true,
    docRequests: true,
    payments: true,
    advice: false,
  })
  const [analystTypes, setAnalystTypes] = useState({
    sla: true,
    queue: true,
    clientDocs: true,
    checks: true,
    assignments: true,
  })

  const pendingInvites = myInvitesQ.data ?? []
  const items = useMemo(() => {
    const byCode = new Map(pendingInvites.map((i) => [i.code, i]))
    const byId = new Map(pendingInvites.map((i) => [i.id, i]))
    const byCompany = new Map(
      pendingInvites.filter((i) => i.companyId).map((i) => [i.companyId!, i]),
    )
    return (listQ.data?.items ?? []).map((raw) => {
      const n = mapItem(raw, analyst)
      if (!n.inviteCode && !n.inviteId && !n.inviteCompanyId) return n
      const live =
        (n.inviteCode && byCode.get(n.inviteCode)) ||
        (n.inviteId && byId.get(n.inviteId)) ||
        (n.inviteCompanyId && byCompany.get(n.inviteCompanyId)) ||
        undefined
      return {
        ...n,
        liveInviteCode: live?.code,
      }
    })
  }, [listQ.data, analyst, pendingInvites])

  const unreadCount = listQ.data?.unreadCount ?? items.filter((i) => i.unread).length

  const filtered = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((i) => i.category === tab)
  }, [items, tab])

  const tabs: { key: TabKey; label: string; badge?: number }[] = analyst
    ? [
        { key: 'all', label: 'Все', badge: unreadCount || undefined },
        { key: 'sla', label: 'SLA' },
        { key: 'queue', label: 'Очередь' },
        { key: 'documents', label: 'Документы' },
        { key: 'system', label: 'Система' },
      ]
    : [
        { key: 'all', label: 'Все', badge: unreadCount || undefined },
        { key: 'applications', label: 'Заявки' },
        { key: 'documents', label: 'Документы' },
        { key: 'payments', label: 'Платежи' },
        { key: 'system', label: 'Система' },
      ]

  if (user?.role === 'admin') {
    return <Navigate to="/app/admin/notifications" replace />
  }

  function markAllRead() {
    if (unreadCount === 0) return
    markAllM.mutate()
  }

  function openItem(n: Notification) {
    if (n.unread) {
      void markNotificationRead(n.id)
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined)
    }
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
            {analyst
              ? `${unreadCount > 0 ? `${unreadCount} новых` : 'Все прочитаны'} · очередь и SLA по вашим заявкам`
              : `${unreadCount > 0 ? `${unreadCount} новых` : 'Все прочитаны'} · за последние 30 дней`}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          disabled={unreadCount === 0 || markAllM.isPending}
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
          {inviteActionError && (
            <Alert
              severity="error"
              sx={{ borderRadius: 2.5 }}
              onClose={() => setInviteActionError(null)}
            >
              {inviteActionError}
            </Alert>
          )}
          {listQ.isLoading && (
            <Box sx={{ ...tileSx, textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#EF3124' }} />
            </Box>
          )}
          {listQ.isError && !listQ.data && (
            <Box sx={{ ...tileSx, textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#C41E14', fontSize: 14, fontWeight: 600 }}>
                Не удалось загрузить уведомления
              </Typography>
            </Box>
          )}
          {!listQ.isLoading &&
            !listQ.isError &&
            filtered.map((n) => {
              const meta = KIND_META[n.kind]
              const Icon = meta.Icon
              const actionableCode = n.liveInviteCode
              const isInvite = Boolean(n.inviteCode || n.inviteId || n.inviteCompanyId)
              const canAct = Boolean(actionableCode)
              return (
                <Box
                  key={n.id}
                  {...(isInvite
                    ? {}
                    : {
                        component: 'button' as const,
                        type: 'button' as const,
                        onClick: () => openItem(n),
                      })}
                  sx={{
                    ...(isInvite ? {} : { all: 'unset', cursor: 'pointer' }),
                    display: 'block',
                    boxSizing: 'border-box',
                    width: '100%',
                    textAlign: 'left',
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
                    ...(!isInvite
                      ? {
                          '&:hover': {
                            borderColor: n.unread
                              ? 'rgba(239,49,36,0.45)'
                              : 'rgba(11,31,53,0.14)',
                            bgcolor: n.unread
                              ? 'rgba(239,49,36,0.015)'
                              : 'rgba(11,31,53,0.015)',
                          },
                        }
                      : {}),
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
                      {isInvite && canAct && actionableCode && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                          <Button
                            size="small"
                            variant="text"
                            color="secondary"
                            disabled={inviteActionM.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (n.unread) {
                                void markNotificationRead(n.id).catch(() => undefined)
                              }
                              inviteActionM.mutate({
                                code: actionableCode,
                                action: 'decline',
                                companyId: n.inviteCompanyId,
                              })
                            }}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 700,
                              textTransform: 'none',
                              color: '#5A6B7D',
                            }}
                          >
                            Отказаться
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            disabled={inviteActionM.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (n.unread) {
                                void markNotificationRead(n.id).catch(() => undefined)
                              }
                              inviteActionM.mutate({
                                code: actionableCode,
                                action: 'accept',
                                companyId: n.inviteCompanyId,
                              })
                            }}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 700,
                              textTransform: 'none',
                              boxShadow: 'none',
                              '&:hover': { boxShadow: 'none' },
                            }}
                          >
                            Принять
                          </Button>
                        </Stack>
                      )}
                      {isInvite && !canAct && (
                        <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 1, fontWeight: 600 }}>
                          Приглашение уже обработано
                        </Typography>
                      )}
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

          {!listQ.isLoading && !listQ.isError && filtered.length === 0 && (
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
              {analyst ? 'SLA-алерты не отключаются в тихие часы' : 'Тихие часы: 22:00–08:00'}
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
              {analyst
                ? (
                    [
                      ['sla', 'Просрочка и SLA'],
                      ['queue', 'Новые в очереди'],
                      ['assignments', 'Назначения на меня'],
                      ['clientDocs', 'Ответы клиента / документы'],
                      ['checks', 'Автопроверки и ML'],
                    ] as const
                  ).map(([key, label]) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Checkbox
                          checked={analystTypes[key]}
                          onChange={(_, v) => setAnalystTypes((t) => ({ ...t, [key]: v }))}
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
                  ))
                : (
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
                          checked={entrepreneurTypes[key]}
                          onChange={(_, v) => setEntrepreneurTypes((t) => ({ ...t, [key]: v }))}
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
