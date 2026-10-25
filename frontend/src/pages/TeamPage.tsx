import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import PinOutlinedIcon from '@mui/icons-material/PinOutlined'
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
  },
} as const

type TeamRole = 'owner' | 'accountant' | 'viewer'
type TeamStatus = 'active' | 'invited'

type Member = {
  id: string
  name: string
  email: string
  role: TeamRole
  rights: string
  lastLogin: string
  status: TeamStatus
  statusLabel: string
}

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Владелец',
  accountant: 'Бухгалтер',
  viewer: 'Наблюдатель',
}

const DEMO_MEMBERS: Member[] = [
  {
    id: 'm1',
    name: 'Миронов Сергей Павлович',
    email: 'sergey.mironov@kofeplus.demo',
    role: 'owner',
    rights: 'Все разделы и управление доступом',
    lastLogin: '23.10.2026 · 10:11',
    status: 'active',
    statusLabel: 'Активен',
  },
  {
    id: 'm2',
    name: 'Лебедева Ирина Олеговна',
    email: 'buh@kofeplus.demo',
    role: 'accountant',
    rights: 'Документы, финансы, заявки',
    lastLogin: '22.10.2026 · 18:40',
    status: 'active',
    statusLabel: 'Активна',
  },
  {
    id: 'm3',
    name: 'Громов Артём Викторович',
    email: 'gromov@kofeplus.demo',
    role: 'viewer',
    rights: 'Только просмотр заявок',
    lastLogin: '—',
    status: 'invited',
    statusLabel: 'Приглашён',
  },
]

const MATRIX: { label: string; owner: boolean; accountant: boolean; viewer: boolean }[] = [
  { label: 'Подавать заявки', owner: true, accountant: true, viewer: false },
  { label: 'Загружать документы', owner: true, accountant: true, viewer: false },
  { label: 'Видеть финансы', owner: true, accountant: true, viewer: false },
  { label: 'Принимать условия', owner: true, accountant: false, viewer: false },
  { label: 'Управлять командой', owner: true, accountant: false, viewer: false },
  { label: 'Просмотр заявок', owner: true, accountant: true, viewer: true },
]

function StatusChip({ status, label }: { status: TeamStatus; label: string }) {
  const active = status === 'active'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        px: 1,
        py: 0.35,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: active ? '#E6F5EE' : '#FFF0E0',
        color: active ? '#1B8A5A' : '#C45A12',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

function MatrixIcon({ ok }: { ok: boolean }) {
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        bgcolor: ok ? '#1B8A5A' : '#C5CCD3',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        mx: 'auto',
      }}
    >
      {ok ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <CloseRoundedIcon sx={{ fontSize: 14 }} />}
    </Box>
  )
}

export function TeamPage() {
  const { user } = useAuth()
  const inviteRef = useRef<HTMLDivElement | null>(null)

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user),
  })
  const company =
    companiesQ.data?.find((c) => c.id === user?.companyId) ?? companiesQ.data?.[0] ?? null
  const companyName = company?.name || 'ООО «Кофе Плюс»'

  const [members, setMembers] = useState(DEMO_MEMBERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | TeamRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TeamStatus>('all')
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuId, setMenuId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('accountant')
  const [inviteMsg, setInviteMsg] = useState(
    `Подключайтесь к кабинету «${companyName.replace(/^ООО\s*/i, '').replace(/[«»"]/g, '')}»`,
  )
  const [inviteSent, setInviteSent] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  const inviteCode = useMemo(() => {
    const seed = (user?.companyId || company?.id || 'demo').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()
    const roleLetter = inviteRole === 'owner' ? 'O' : inviteRole === 'accountant' ? 'A' : 'V'
    return `LR-${roleLetter}${seed}-4821`
  }, [user?.companyId, company?.id, inviteRole])

  const inviteLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
    const cid = user?.companyId || company?.id || 'demo'
    return `${origin}/select-company?invite=${encodeURIComponent(inviteCode)}&company=${encodeURIComponent(cid)}&role=${inviteRole}`
  }, [inviteCode, inviteRole, user?.companyId, company?.id])

  const activeCount = members.filter((m) => m.status === 'active').length
  const invitedCount = members.filter((m) => m.status === 'invited').length

  async function copyText(text: string, kind: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(text)
      if (kind === 'link') {
        setLinkCopied(true)
        window.setTimeout(() => setLinkCopied(false), 2000)
      } else {
        setCodeCopied(true)
        window.setTimeout(() => setCodeCopied(false), 2000)
      }
    } catch {
      /* ignore */
    }
  }

  function sendCodeOnly() {
    const email = inviteEmail.trim()
    if (email && !email.includes('@')) return
    setCodeSent(true)
    window.setTimeout(() => setCodeSent(false), 2200)
    if (email.includes('@')) {
      const name = email.split('@')[0] ?? 'Участник'
      setMembers((list) => {
        if (list.some((m) => m.email.toLowerCase() === email.toLowerCase())) return list
        return [
          ...list,
          {
            id: `inv_${Date.now()}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            email,
            role: inviteRole,
            rights:
              inviteRole === 'owner'
                ? 'Все разделы и управление доступом'
                : inviteRole === 'accountant'
                  ? 'Документы, финансы, заявки'
                  : 'Только просмотр заявок',
            lastLogin: '—',
            status: 'invited',
            statusLabel: 'Приглашён',
          },
        ]
      })
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!q) return true
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })
  }, [members, search, roleFilter, statusFilter])

  function scrollToInvite() {
    inviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function sendInvite() {
    const email = inviteEmail.trim()
    if (!email || !email.includes('@')) return
    const name = email.split('@')[0] ?? 'Участник'
    setMembers((list) => [
      ...list,
      {
        id: `inv_${Date.now()}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email,
        role: inviteRole,
        rights:
          inviteRole === 'owner'
            ? 'Все разделы и управление доступом'
            : inviteRole === 'accountant'
              ? 'Документы, финансы, заявки'
              : 'Только просмотр заявок',
        lastLogin: '—',
        status: 'invited',
        statusLabel: 'Приглашён',
      },
    ])
    setInviteEmail('')
    setInviteSent(true)
    window.setTimeout(() => setInviteSent(false), 2200)
  }

  function removeMember(id: string) {
    setMembers((list) => list.filter((m) => m.id !== id))
    setMenuAnchor(null)
    setMenuId(null)
  }

  const thSx = {
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 700,
    color: '#9AA5B1',
    pb: 1.25,
    pr: 1.5,
    borderBottom: '1px solid rgba(11,31,53,0.08)',
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
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
            Команда компании
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            {`${companyName} · ${activeCount} ${
              activeCount === 1 ? 'участник' : activeCount < 5 ? 'участника' : 'участников'
            }${
              invitedCount > 0
                ? `, ${invitedCount} приглашени${invitedCount === 1 ? 'е' : 'я'}`
                : ''
            }`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={scrollToInvite}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            px: 2.25,
            py: 1.1,
            boxShadow: 'none',
            alignSelf: 'flex-start',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          Пригласить сотрудника
        </Button>
      </Stack>

      {/* Filters */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'minmax(0, 1.6fr) minmax(140px, 0.7fr) minmax(140px, 0.7fr)',
          },
          mb: 2,
        }}
      >
        <TextField
          placeholder="Поиск по имени и e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={fieldSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 20, color: '#9AA5B1' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Роль"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          sx={fieldSx}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="owner">Владелец</MenuItem>
          <MenuItem value="accountant">Бухгалтер</MenuItem>
          <MenuItem value="viewer">Наблюдатель</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Статус"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          sx={fieldSx}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="active">Активен</MenuItem>
          <MenuItem value="invited">Приглашён</MenuItem>
        </TextField>
      </Box>

      {/* Members table */}
      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 720,
          }}
        >
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={thSx}>
                Участник
              </Box>
              <Box component="th" sx={thSx}>
                Роль
              </Box>
              <Box component="th" sx={{ ...thSx, minWidth: 180 }}>
                Права
              </Box>
              <Box component="th" sx={thSx}>
                Последний вход
              </Box>
              <Box component="th" sx={thSx}>
                Статус
              </Box>
              <Box component="th" sx={{ ...thSx, width: 40, pr: 0 }} />
            </Box>
          </Box>
          <Box component="tbody">
            {filtered.map((m) => (
              <Box
                component="tr"
                key={m.id}
                sx={{
                  '& td': {
                    py: 1.5,
                    pr: 1.5,
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    verticalAlign: 'middle',
                  },
                }}
              >
                <Box component="td">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', lineHeight: 1.3 }}>
                    {m.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.25 }}>{m.email}</Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                    {ROLE_LABEL[m.role]}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D', lineHeight: 1.35 }}>
                    {m.rights}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D', whiteSpace: 'nowrap' }}>
                    {m.lastLogin}
                  </Typography>
                </Box>
                <Box component="td">
                  <StatusChip status={m.status} label={m.statusLabel} />
                </Box>
                <Box component="td" sx={{ pr: '0 !important', textAlign: 'right' }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      setMenuAnchor(e.currentTarget)
                      setMenuId(m.id)
                    }}
                    sx={{ color: '#9AA5B1' }}
                  >
                    <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={6} sx={{ py: 3, textAlign: 'center' }}>
                  <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                    Никого не найдено по фильтрам
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null)
          setMenuId(null)
        }}
      >
        <MenuItem
          disabled={members.find((m) => m.id === menuId)?.role === 'owner'}
          onClick={() => menuId && removeMember(menuId)}
        >
          Отозвать доступ
        </MenuItem>
      </Menu>

      {/* Bottom: matrix + invite */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Матрица ролей
          </Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr">
                {['Возможность', 'Владелец', 'Бухгалтер', 'Наблюдатель'].map((h, i) => (
                  <Box
                    component="th"
                    key={h}
                    sx={{
                      ...thSx,
                      textAlign: i === 0 ? 'left' : 'center',
                      pr: i === 3 ? 0 : 1.5,
                      fontSize: 11.5,
                    }}
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {MATRIX.map((row) => (
                <Box
                  component="tr"
                  key={row.label}
                  sx={{
                    '& td': {
                      py: 1.15,
                      borderBottom: '1px solid rgba(11,31,53,0.06)',
                      verticalAlign: 'middle',
                    },
                  }}
                >
                  <Box component="td">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                      {row.label}
                    </Typography>
                  </Box>
                  <Box component="td" sx={{ textAlign: 'center' }}>
                    <MatrixIcon ok={row.owner} />
                  </Box>
                  <Box component="td" sx={{ textAlign: 'center' }}>
                    <MatrixIcon ok={row.accountant} />
                  </Box>
                  <Box component="td" sx={{ textAlign: 'center' }}>
                    <MatrixIcon ok={row.viewer} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box ref={inviteRef} sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Пригласить участника
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              label="E-mail"
              placeholder="name@company.ru"
              fullWidth
              size="small"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              sx={fieldSx}
            />
            <TextField
              select
              label="Роль"
              fullWidth
              size="small"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              sx={fieldSx}
            >
              <MenuItem value="accountant">Бухгалтер</MenuItem>
              <MenuItem value="viewer">Наблюдатель</MenuItem>
              <MenuItem value="owner">Владелец</MenuItem>
            </TextField>
            <TextField
              label="Сообщение"
              fullWidth
              multiline
              minRows={3}
              value={inviteMsg}
              onChange={(e) => setInviteMsg(e.target.value)}
              sx={fieldSx}
            />

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(11,31,53,0.03)',
                border: '1px solid rgba(11,31,53,0.08)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <LinkRoundedIcon sx={{ fontSize: 18, color: '#EF3124' }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0B1F35' }}>
                  Ссылка для уже зарегистрированных
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#7A8795', mb: 1.1, lineHeight: 1.4 }}>
                Скопируйте и отправьте коллеге в мессенджер — откроет кабинет по invite.
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={inviteLink}
                InputProps={{
                  readOnly: true,
                  sx: { fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={linkCopied ? 'Скопировано' : 'Копировать ссылку'}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => void copyText(inviteLink, 'link')}
                          aria-label="Копировать ссылку"
                        >
                          {linkCopied ? (
                            <CheckRoundedIcon sx={{ fontSize: 18, color: '#1B8A5A' }} />
                          ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
              <Button
                type="button"
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={() => void copyText(inviteLink, 'link')}
                sx={{ mt: 1.25, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                {linkCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
              </Button>
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(11,31,53,0.03)',
                border: '1px solid rgba(11,31,53,0.08)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <PinOutlinedIcon sx={{ fontSize: 18, color: '#EF3124' }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0B1F35' }}>
                  Код приглашения
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    flex: 1,
                    px: 1.5,
                    py: 1.1,
                    borderRadius: 2,
                    border: '1px dashed rgba(11,31,53,0.18)',
                    bgcolor: '#fff',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 15,
                    fontWeight: 750,
                    letterSpacing: '0.04em',
                    color: '#0B1F35',
                    textAlign: 'center',
                  }}
                >
                  {inviteCode}
                </Box>
                <Tooltip title={codeCopied ? 'Скопировано' : 'Копировать код'}>
                  <IconButton
                    onClick={() => void copyText(inviteCode, 'code')}
                    sx={{
                      border: '1px solid rgba(11,31,53,0.12)',
                      borderRadius: 2,
                      bgcolor: '#fff',
                    }}
                    aria-label="Копировать код"
                  >
                    {codeCopied ? (
                      <CheckRoundedIcon sx={{ color: '#1B8A5A' }} />
                    ) : (
                      <ContentCopyRoundedIcon />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
              <Button
                type="button"
                fullWidth
                variant="outlined"
                color="primary"
                onClick={sendCodeOnly}
                sx={{ mt: 1.25, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                {codeSent
                  ? 'Код отправлен'
                  : inviteEmail.trim().includes('@')
                    ? 'Отправить только код на e-mail'
                    : 'Отправить только код'}
              </Button>
            </Box>

            <Divider sx={{ borderColor: 'rgba(11,31,53,0.08)' }} />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              disabled={!inviteEmail.trim().includes('@')}
              onClick={sendInvite}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                py: 1.15,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {inviteSent ? 'Отправлено' : 'Отправить приглашение'}
            </Button>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1', textAlign: 'center', lineHeight: 1.4 }}>
              Приглашение действует 7 дней. Ссылка — для пользователей, уже зарегистрированных на
              платформе; код можно отправить отдельно.
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
