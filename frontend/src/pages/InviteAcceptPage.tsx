import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { acceptInvite } from '@/api/team'
import { getCompany, listCompanies } from '@/api/companies'
import { LogoutConfirmDialog } from '@/components/common/LogoutConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABEL, ROLE_RIGHTS_TEXT, type TeamRole } from '@/features/team/store'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3.5,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 4px 24px rgba(11,31,53,0.06)',
  p: { xs: 2.5, md: 3 },
} as const

const ROLE_RIGHTS: Record<TeamRole, { label: string; ok: boolean }[]> = {
  accountant: [
    { label: 'Подавать заявки', ok: true },
    { label: 'Загружать документы', ok: true },
    { label: 'Видеть финансы', ok: true },
    { label: 'Принимать условия', ok: false },
    { label: 'Управлять командой', ok: false },
    { label: 'Просмотр заявок', ok: true },
  ],
  viewer: [
    { label: 'Подавать заявки', ok: false },
    { label: 'Загружать документы', ok: false },
    { label: 'Видеть финансы', ok: false },
    { label: 'Принимать условия', ok: false },
    { label: 'Управлять командой', ok: false },
    { label: 'Просмотр заявок', ok: true },
  ],
  owner: [
    { label: 'Подавать заявки', ok: true },
    { label: 'Загружать документы', ok: true },
    { label: 'Видеть финансы', ok: true },
    { label: 'Принимать условия', ok: true },
    { label: 'Управлять командой', ok: true },
    { label: 'Просмотр заявок', ok: true },
  ],
}

function parseRole(raw: string | null): TeamRole {
  if (raw === 'owner' || raw === 'accountant' || raw === 'viewer') return raw
  return 'accountant'
}

function RightIcon({ ok }: { ok: boolean }) {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        bgcolor: ok ? '#1B8A5A' : '#C5CCD3',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {ok ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <CloseRoundedIcon sx={{ fontSize: 13 }} />}
    </Box>
  )
}

/** Экран получателя ссылки `/select-company?invite=…&company=…&role=…` */
function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
  }
  if (err instanceof Error) return err.message
  return fallback
}

export function InviteAcceptPage() {
  const { user, selectCompany, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const inviteCode = (params.get('invite') ?? '').trim()
  const companyId = (params.get('company') ?? '').trim()
  const role = parseRole(params.get('role'))
  const companyNameFromLink = (params.get('companyName') ?? '').trim()
  const inviterName = (params.get('from') ?? '').trim() || 'Владелец компании'

  const invalid = !inviteCode

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user) && !invalid,
  })

  const alreadyMember = useMemo(
    () => (companiesQ.data ?? []).some((c) => c.id === companyId),
    [companiesQ.data, companyId],
  )

  const companyFromList = useMemo(
    () => (companiesQ.data ?? []).find((c) => c.id === companyId) ?? null,
    [companiesQ.data, companyId],
  )

  const companyQ = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId),
    enabled: Boolean(companyId) && !invalid && !companyFromList && !companyNameFromLink,
    retry: false,
  })

  const companyName =
    companyNameFromLink ||
    companyFromList?.name ||
    companyQ.data?.name ||
    (companyQ.isError ? 'Компания' : null)

  const companyInn = companyFromList?.inn || companyQ.data?.inn || null
  const companyRegion = companyFromList?.region || companyQ.data?.region || null

  const loadingMeta =
    !invalid &&
    !companyNameFromLink &&
    !companyFromList &&
    (companiesQ.isLoading || companyQ.isLoading)

  function clearInviteAndGo(path: string) {
    navigate(path, { replace: true })
  }

  async function onAccept() {
    if (invalid || busy) return
    setBusy(true)
    setAcceptError(null)
    try {
      const res = await acceptInvite(inviteCode)
      const nextId = res.companyId || companyId
      if (nextId) selectCompany(nextId)
      setDone('accepted')
      window.setTimeout(() => {
        clearInviteAndGo('/app')
      }, 700)
    } catch (err) {
      setBusy(false)
      setAcceptError(apiError(err, 'Не удалось принять приглашение'))
    }
  }

  function onDecline() {
    setDone('declined')
    window.setTimeout(() => {
      if (user?.companyId || (companiesQ.data && companiesQ.data.length > 0)) {
        clearInviteAndGo('/select-company')
      } else {
        clearInviteAndGo('/select-company')
      }
    }, 500)
  }

  function onContinueExisting() {
    selectCompany(companyId)
    clearInviteAndGo('/app')
  }

  function confirmLogout() {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  if (invalid) {
    return (
      <Shell onLogout={() => setLogoutOpen(true)}>
        <Box sx={{ ...tileSx, maxWidth: 480, mx: 'auto', textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 22,
              color: '#0B1F35',
              letterSpacing: '-0.02em',
              mb: 1,
            }}
          >
            Ссылка недействительна
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.5, mb: 2.5 }}>
            В приглашении нет кода. Попросите владельца прислать новую ссылку.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => clearInviteAndGo('/select-company')}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', py: 1.2 }}
          >
            К выбору компании
          </Button>
        </Box>
        <LogoutConfirmDialog
          open={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onConfirm={confirmLogout}
        />
      </Shell>
    )
  }

  return (
    <Shell onLogout={() => setLogoutOpen(true)}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 720,
          mx: 'auto',
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(240px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(239,49,36,0.1)',
                color: '#EF3124',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <GroupAddOutlinedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: 22, md: 24 },
                  letterSpacing: '-0.03em',
                  color: '#0B1F35',
                  lineHeight: 1.2,
                }}
              >
                Вас пригласили в команду
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', mt: 0.35 }}>
                {inviterName} предлагает доступ к кабинету
              </Typography>
            </Box>
          </Stack>

          {loadingMeta ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#EF3124' }} />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(11,31,53,0.02)',
                  border: '1px solid rgba(11,31,53,0.08)',
                  mb: 2,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      bgcolor: '#EEF1F5',
                      color: '#5A6B7D',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BusinessOutlinedIcon />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 800,
                        fontSize: 16,
                        color: '#0B1F35',
                        lineHeight: 1.25,
                      }}
                    >
                      {companyName ?? 'Компания'}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 0.3 }}>
                      {[companyInn ? `ИНН ${companyInn}` : null, companyRegion]
                        .filter(Boolean)
                        .join(' · ') || `Код: ${inviteCode}`}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Stack spacing={1.1} sx={{ mb: 2 }}>
                {(
                  [
                    { k: 'Роль', v: ROLE_LABEL[role] },
                    { k: 'Доступ', v: ROLE_RIGHTS_TEXT[role] },
                    { k: 'Код приглашения', v: inviteCode },
                    { k: 'Ваш аккаунт', v: user?.email ?? '—' },
                  ] as const
                ).map((row) => (
                  <Stack
                    key={row.k}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                    spacing={2}
                    sx={{
                      py: 1,
                      borderBottom: '1px solid rgba(11,31,53,0.06)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: '#8A96A3', flexShrink: 0 }}>
                      {row.k}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0B1F35',
                        textAlign: 'right',
                        wordBreak: 'break-all',
                      }}
                    >
                      {row.v}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {acceptError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }}>
                  {acceptError}
                </Alert>
              )}

              {alreadyMember && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
                  Вы уже в этой компании. Можно сразу открыть кабинет.
                </Alert>
              )}

              {done === 'accepted' && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5 }}>
                  Приглашение принято — открываем кабинет…
                </Alert>
              )}
              {done === 'declined' && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
                  Приглашение отклонено
                </Alert>
              )}

              {alreadyMember ? (
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={onContinueExisting}
                  sx={{
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    py: 1.35,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' },
                  }}
                >
                  Открыть кабинет
                </Button>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={busy || done !== null}
                    onClick={onAccept}
                    sx={{
                      flex: 1.2,
                      borderRadius: 2.5,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1.35,
                      boxShadow: 'none',
                      '&:hover': { boxShadow: 'none' },
                    }}
                  >
                    {busy ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      'Принять приглашение'
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    disabled={busy || done !== null}
                    onClick={onDecline}
                    sx={{
                      flex: 1,
                      borderRadius: 2.5,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1.35,
                    }}
                  >
                    Отклонить
                  </Button>
                </Stack>
              )}

              <Typography
                sx={{
                  mt: 1.75,
                  fontSize: 12,
                  color: '#9AA5B1',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                Ссылка действует ограниченное время. После принятия компания появится в списке
                выбора.
              </Typography>
            </>
          )}
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
            Права роли «{ROLE_LABEL[role]}»
          </Typography>
          <Stack spacing={1.1}>
            {ROLE_RIGHTS[role].map((r) => (
              <Stack key={r.label} direction="row" spacing={1.1} alignItems="center">
                <RightIcon ok={r.ok} />
                <Typography
                  sx={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: r.ok ? '#0B1F35' : '#9AA5B1',
                  }}
                >
                  {r.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </Shell>
  )
}

function Shell({
  children,
  onLogout,
}: {
  children: ReactNode
  onLogout: () => void
}) {
  return (
    <Box
      sx={{
        height: '100vh',
        maxHeight: '100dvh',
        bgcolor: '#F3F5F8',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 1180,
          mx: 'auto',
          px: { xs: 2, md: 3, lg: 4 },
          py: { xs: 2.5, md: 3.5 },
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 26, md: 30 },
            letterSpacing: '-0.035em',
            color: '#0B1F35',
            lineHeight: 1.12,
            mb: 0.75,
          }}
        >
          Приглашение в компанию
        </Typography>
        <Typography sx={{ color: '#5A6B7D', fontSize: 15, mb: 2.5, lineHeight: 1.4 }}>
          Подтвердите доступ — или отклоните, если ссылка не для вас
        </Typography>
        {children}
        <Button
          onClick={onLogout}
          sx={{
            mt: 2.5,
            color: '#8A96A3',
            fontWeight: 600,
            textTransform: 'none',
          }}
        >
          Выйти из аккаунта
        </Button>
      </Box>
    </Box>
  )
}
