import {
  Box,
  Button,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  loadTeamMembers,
  ROLE_LABEL,
  ROLE_RIGHTS_TEXT,
  type TeamMember,
  type TeamRole,
  updateTeamMemberRole,
  removeTeamMember,
} from '@/features/team/store'
import { useAuth } from '@/contexts/AuthContext'

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

const ROLE_OPTIONS: { value: TeamRole; title: string; desc: string }[] = [
  {
    value: 'owner',
    title: 'Владелец',
    desc: 'Полный доступ, управление командой и условиями',
  },
  {
    value: 'accountant',
    title: 'Бухгалтер',
    desc: 'Заявки, документы, финансы — без управления командой',
  },
  {
    value: 'viewer',
    title: 'Наблюдатель',
    desc: 'Только просмотр заявок и статусов',
  },
]

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function makeAccessCode(role: TeamRole) {
  const prefix = role === 'owner' ? 'OWN' : role === 'accountant' ? 'ACC' : 'VIEW'
  const n = Math.floor(10 + Math.random() * 89)
  return `${prefix}-ACCESS-${n}`
}

function seedOwner(user: { id: string; fullName: string; email?: string } | null): TeamMember {
  return {
    id: user?.id || 'owner',
    name: user?.fullName || 'Владелец компании',
    email: user?.email || 'owner@company.demo',
    role: 'owner',
    rights: ROLE_RIGHTS_TEXT.owner,
    lastLogin: 'сегодня',
    status: 'active',
    statusLabel: 'Активен',
  }
}

export function TeamMemberPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const base = useMemo(() => {
    if (!memberId) return undefined
    return loadTeamMembers(seedOwner(user)).find((m) => m.id === memberId)
  }, [memberId, user])

  const [role, setRole] = useState<TeamRole>(base?.role ?? 'viewer')
  const [savedRole, setSavedRole] = useState<TeamRole>(base?.role ?? 'viewer')
  const [accessCode, setAccessCode] = useState(() =>
    base ? makeAccessCode(base.role) : 'ACC-ACCESS-19',
  )
  const [revoked, setRevoked] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [history, setHistory] = useState(
    () =>
      (base
        ? `${new Date().toLocaleDateString('ru-RU')} — текущая роль ${ROLE_LABEL[base.role]}`
        : ''),
  )

  useEffect(() => {
    if (!base) return
    setRole(base.role)
    setSavedRole(base.role)
    setAccessCode(makeAccessCode(base.role))
    setRevoked(false)
    setSavedFlash(false)
    setHistory(`${new Date().toLocaleDateString('ru-RU')} — текущая роль ${ROLE_LABEL[base.role]}`)
  }, [base])

  const dirty = role !== savedRole
  const displayName = base?.name ?? 'Участник'

  if (!base) {
    return <Navigate to="/app/team" replace />
  }

  function saveRole() {
    if (!base) return
    updateTeamMemberRole(base.id, role)
    setSavedRole(role)
    setHistory(
      (h) =>
        `${h} · ${new Date().toLocaleDateString('ru-RU')} — смена на ${ROLE_LABEL[role]}`,
    )
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
  }

  function revoke() {
    if (!base) return
    removeTeamMember(base.id)
    setRevoked(true)
    window.setTimeout(() => navigate('/app/team'), 900)
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
          {displayName}
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
              fontSize: { xs: 24, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Участник · смена роли и доступа
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.65 }}>
            {base.name} · {base.email} ·{' '}
            {base.status === 'invited' ? 'приглашён' : `активен · ${base.lastLogin}`}
          </Typography>
        </Box>
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
          gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: '#E8ECF0',
                color: '#5A6B7D',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {initialsOf(base.name)}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0B1F35' }}>
                  {base.name}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.3,
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    bgcolor: revoked
                      ? '#F2F4F6'
                      : base.status === 'active'
                        ? '#E6F5EE'
                        : '#FFF0E0',
                    color: revoked
                      ? '#7A8795'
                      : base.status === 'active'
                        ? '#1B8A5A'
                        : '#C45A12',
                  }}
                >
                  {revoked ? 'Отозван' : base.statusLabel}
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 13, color: '#9AA5B1', mt: 0.25 }}>{base.email}</Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1.5,
              mb: 2.25,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 0.35 }}>Текущая роль</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35' }}>
                {ROLE_LABEL[savedRole]}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 0.35 }}>Последний вход</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35' }}>
                {base.lastLogin}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 2.25 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#5A6B7D', mb: 0.75 }}>
              Код доступа (опционально)
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                value={accessCode}
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
                onClick={() => setAccessCode(makeAccessCode(savedRole))}
                startIcon={<RefreshRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  px: 1.75,
                }}
              >
                Сменить
              </Button>
            </Stack>
          </Box>

          <Button
            type="button"
            fullWidth
            disabled={revoked || base.role === 'owner'}
            onClick={revoke}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.15,
              color: '#C41E14',
              bgcolor: 'rgba(196,30,20,0.06)',
              border: '1px solid rgba(196,30,20,0.22)',
              '&:hover': {
                bgcolor: 'rgba(196,30,20,0.1)',
                borderColor: 'rgba(196,30,20,0.4)',
              },
              '&.Mui-disabled': {
                color: '#9AA5B1',
                bgcolor: '#F2F4F6',
                borderColor: 'transparent',
              },
            }}
          >
            {revoked ? 'Доступ отозван' : 'Отозвать доступ'}
          </Button>
          <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1, lineHeight: 1.4 }}>
            Отзыв сразу закрывает вход и активные сессии.
          </Typography>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 0.75,
            }}
          >
            Сменить роль
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: '#7A8795', mb: 2, lineHeight: 1.45 }}>
            Выберите роль для этого человека. Права применяются сразу.
          </Typography>

          <Stack spacing={1.25} sx={{ mb: 2.5 }}>
            {ROLE_OPTIONS.map((opt) => {
              const selected = role === opt.value
              return (
                <Box
                  key={opt.value}
                  component="button"
                  type="button"
                  onClick={() => setRole(opt.value)}
                  disabled={revoked}
                  sx={{
                    all: 'unset',
                    cursor: revoked ? 'default' : 'pointer',
                    display: 'block',
                    p: 1.5,
                    borderRadius: 2.5,
                    border: selected
                      ? '1.5px solid #EF3124'
                      : '1px solid rgba(11,31,53,0.1)',
                    bgcolor: selected ? 'rgba(239,49,36,0.03)' : '#fff',
                    boxSizing: 'border-box',
                    opacity: revoked ? 0.55 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                    '&:hover': revoked
                      ? undefined
                      : {
                          borderColor: selected ? '#EF3124' : 'rgba(11,31,53,0.22)',
                        },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Radio
                      checked={selected}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                      sx={{
                        p: 0,
                        mt: 0.15,
                        color: '#C5CCD3',
                        '&.Mui-checked': { color: '#EF3124' },
                      }}
                    />
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35' }}>
                        {opt.title}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.35, lineHeight: 1.4 }}>
                        {opt.desc}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )
            })}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
            <Button
              type="button"
              variant="contained"
              color="primary"
              disabled={!dirty || revoked}
              onClick={saveRole}
              sx={{
                flex: 1,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                py: 1.15,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {savedFlash ? 'Сохранено' : 'Сохранить роль'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              color="secondary"
              onClick={() => (dirty ? setRole(savedRole) : navigate('/app/team'))}
              sx={{
                flex: 1,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                py: 1.15,
              }}
            >
              Отмена
            </Button>
          </Stack>

          <Typography sx={{ fontSize: 12, color: '#9AA5B1', lineHeight: 1.45 }}>
            История: {history}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
