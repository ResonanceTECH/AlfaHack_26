import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelInvite,
  daysLeft,
  inviteMember,
  listInvites,
  toInviteApiRole,
  type CompanyInvite,
} from '@/api/team'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import type { TeamRole } from '@/features/team/store'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.5 },
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
  },
} as const

type InviteRole = 'accountant' | 'viewer'

type ActiveInvite = {
  id: string
  name: string
  email: string
  role: InviteRole
  code: string
  daysLeft: number
}

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

function nameFromEmail(email: string): string {
  const part = email.split('@')[0] ?? 'Участник'
  return (
    part
      .split(/[._-]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ') || 'Участник'
  )
}

function toActive(inv: CompanyInvite): ActiveInvite {
  const code = inv.code || inv.id
  return {
    id: inv.id,
    name: inv.fullName || nameFromEmail(inv.email),
    email: inv.email,
    role: inv.role === 'viewer' ? 'viewer' : 'accountant',
    code: code.length > 8 ? `${code.slice(0, 6)}…${code.slice(-2)}` : code,
    daysLeft: daysLeft(inv.expiresAt),
  }
}

const ROLE_LABEL: Record<InviteRole, string> = {
  accountant: 'Бухгалтер',
  viewer: 'Наблюдатель',
}

const ROLE_RIGHTS: Record<InviteRole, { label: string; ok: boolean }[]> = {
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
}

const INITIAL_ACTIVE: ActiveInvite[] = []

function randomCodeSuffix(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
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

export function TeamInvitePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user),
  })
  const company =
    companiesQ.data?.find((c) => c.id === user?.companyId) ?? companiesQ.data?.[0] ?? null
  const companyShort =
    (company?.name || 'Кофе Плюс').replace(/^ООО\s*/i, '').replace(/[«»"]/g, '') || 'Кофе Плюс'

  const [email, setEmail] = useState('maria.new@coffeeplus.ru')
  const [role, setRole] = useState<InviteRole>('accountant')
  const [message, setMessage] = useState(
    `Добрый день! Подключайтесь к кабинету «${companyShort}» — нужен доступ к заявкам и документам.`,
  )
  const [code, setCode] = useState('INV-COFFEE-7K2M')
  const [sendEmail, setSendEmail] = useState(false)
  const [showCodeInCabinet, setShowCodeInCabinet] = useState(false)
  const [sentFlash, setSentFlash] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [active, setActive] = useState<ActiveInvite[]>(INITIAL_ACTIVE)
  const [cancelTarget, setCancelTarget] = useState<ActiveInvite | null>(null)

  const inviteLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
    const cid = user?.companyId || company?.id || 'demo'
    const qs = new URLSearchParams({
      invite: code,
      company: cid,
      role,
      companyName: company?.name || `ООО «${companyShort}»`,
      from: user?.fullName || 'Владелец',
    })
    return `${origin}/select-company?${qs.toString()}`
  }, [code, role, user?.companyId, user?.fullName, company?.id, company?.name, companyShort])

  function regenerateCode() {
    setCode(`INV-COFFEE-${randomCodeSuffix()}`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function sendInvite() {
    const trimmed = email.trim()
    if (!trimmed.includes('@')) return
    const namePart = trimmed.split('@')[0] ?? 'Участник'
    const name = namePart
      .split(/[._-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')

    const id = `inv_${Date.now()}`
    setActive((list) => [
      {
        id,
        name,
        email: trimmed,
        role,
        code: `${code.slice(0, 6)}…${code.slice(-2)}`,
        daysLeft: 7,
      },
      ...list,
    ])
    upsertTeamMember({
      id,
      name,
      email: trimmed,
      role,
      rights: ROLE_RIGHTS_TEXT[role],
      lastLogin: '—',
      status: 'invited',
      statusLabel: 'Приглашён',
    })
    setSentFlash(true)
    window.setTimeout(() => setSentFlash(false), 2200)
  }

  function confirmCancelInvite() {
    if (!cancelTarget) return
    setActive((list) => list.filter((i) => i.id !== cancelTarget.id))
    removeTeamMember(cancelTarget.id)
    setCancelTarget(null)
  }

  function cycleRole(id: string) {
    setActive((list) =>
      list.map((i) => {
        if (i.id !== id) return i
        const next: InviteRole =
          i.role === 'viewer' ? 'accountant' : i.role === 'accountant' ? 'owner' : 'viewer'
        updateTeamMemberRole(id, next)
        return { ...i, role: next }
      }),
    )
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/team"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Команда
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Приглашение сотрудника
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
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
          Пригласить сотрудника
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/app/team')}
          sx={{ alignSelf: 'flex-start', borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
        >
          ← К команде
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        {/* Left: form */}
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 2,
            }}
          >
            Данные приглашения
          </Typography>

          <Stack spacing={1.75}>
            <TextField
              label="E-mail"
              fullWidth
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={fieldSx}
            />
            <TextField
              select
              label="Роль"
              fullWidth
              size="small"
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              sx={fieldSx}
            >
              <MenuItem value="accountant">Бухгалтер</MenuItem>
              <MenuItem value="viewer">Наблюдатель</MenuItem>
              <MenuItem value="owner">Владелец</MenuItem>
            </TextField>
            <TextField
              label="Персональное сообщение"
              fullWidth
              multiline
              minRows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={fieldSx}
            />

            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#5A6B7D', mb: 0.75 }}>
                Код приглашения
              </Typography>
              <Stack direction="row" spacing={1} alignItems="stretch">
                <TextField
                  size="small"
                  fullWidth
                  value={code}
                  InputProps={{
                    readOnly: true,
                    sx: {
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    },
                  }}
                  sx={fieldSx}
                />
                <Button
                  type="button"
                  variant="outlined"
                  color="secondary"
                  onClick={regenerateCode}
                  startIcon={<RefreshRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    px: 1.75,
                  }}
                >
                  Сменить код
                </Button>
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.85, lineHeight: 1.4 }}>
                После смены старый код и ссылка перестанут действовать.
              </Typography>
            </Box>

            <Stack spacing={0.25}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendEmail}
                    onChange={(_, v) => setSendEmail(v)}
                    sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13.5, color: '#0B1F35' }}>
                    Отправить письмо с ссылкой
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showCodeInCabinet}
                    onChange={(_, v) => setShowCodeInCabinet(v)}
                    sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13.5, color: '#0B1F35' }}>
                    Показать код в кабинете (передача лично)
                  </Typography>
                }
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                type="button"
                variant="contained"
                color="primary"
                disabled={!email.trim().includes('@')}
                onClick={sendInvite}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.2,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                {sentFlash ? 'Отправлено' : 'Отправить приглашение'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                color="secondary"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={() => void copyLink()}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.2,
                }}
              >
                {linkCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
              </Button>
            </Stack>

            {showCodeInCabinet && (
              <Box
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(239,49,36,0.04)',
                  border: '1px solid rgba(239,49,36,0.2)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: 12, color: '#7A8795', mb: 0.5 }}>
                  Код для передачи лично
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontWeight: 800,
                    fontSize: 18,
                    letterSpacing: '0.06em',
                    color: '#0B1F35',
                  }}
                >
                  {code}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Right column */}
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
              Активные приглашения
            </Typography>
            <Stack spacing={1.5}>
              {active.map((inv) => (
                <Box
                  key={inv.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    border: '1px solid rgba(11,31,53,0.08)',
                    bgcolor: 'rgba(11,31,53,0.015)',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                        {inv.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.2 }}>
                        {inv.email} · {ROLE_LABEL[inv.role]} · {inv.code}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        bgcolor: '#FFF0E0',
                        color: '#C45A12',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Истекает через {inv.daysLeft}{' '}
                      {inv.daysLeft === 1 ? 'день' : inv.daysLeft < 5 ? 'дня' : 'дней'}
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => cycleRole(inv.id)}
                      sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flex: 1 }}
                    >
                      Сменить роль
                    </Button>
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      onClick={() => setCancelTarget(inv)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        flex: 1,
                        color: '#C41E14',
                        borderColor: 'rgba(196,30,20,0.35)',
                        bgcolor: 'rgba(196,30,20,0.04)',
                        '&:hover': {
                          borderColor: '#C41E14',
                          bgcolor: 'rgba(196,30,20,0.08)',
                        },
                      }}
                    >
                      Прервать
                    </Button>
                  </Stack>
                </Box>
              ))}
              {active.length === 0 && (
                <Typography sx={{ fontSize: 13.5, color: '#9AA5B1', textAlign: 'center', py: 1 }}>
                  Нет активных приглашений
                </Typography>
              )}
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1.75, lineHeight: 1.4 }}>
              Прерывание сразу делает код и ссылку недействительными.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            px: { xs: 2.5, sm: 3.5 },
            py: { xs: 2.75, sm: 3.25 },
            textAlign: 'center',
            boxShadow: '0 16px 48px rgba(11,31,53,0.18)',
          },
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 20,
            color: '#0B1F35',
            letterSpacing: '-0.02em',
            mb: 0.75,
          }}
        >
          Прервать приглашение?
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#9AA5B1', mb: 1.75 }}>
          {cancelTarget ? `${cancelTarget.name} · ${cancelTarget.email}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.5, mb: 0.35 }}>
          Код {cancelTarget?.code ?? ''} и ссылка станут недействительными.
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.5, mb: 2.5 }}>
          Повторное приглашение — только новым кодом.
        </Typography>
        <Stack direction="row" spacing={1.25} justifyContent="center" sx={{ mb: 1.75 }}>
          <Button
            type="button"
            variant="outlined"
            color="secondary"
            onClick={() => setCancelTarget(null)}
            sx={{
              flex: 1,
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.05,
            }}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="contained"
            color="primary"
            onClick={confirmCancelInvite}
            sx={{
              flex: 1.15,
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.05,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Прервать приглашение
          </Button>
        </Stack>
        <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>
          Действие необратимо в рамках этого кода
        </Typography>
      </Dialog>
    </Box>
  )
}
