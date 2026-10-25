import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelInvite, inviteToMember, listInvites, listMembers, removeMember as removeMemberApi } from '@/api/team'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import {
  assignedRoles,
  ROLE_LABEL,
  shouldShowRoleMatrix,
  type TeamRole,
  type TeamStatus,
} from '@/features/team/store'

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

const MATRIX_ROWS: {
  label: string
  flags: Record<TeamRole, boolean>
}[] = [
  { label: 'Подавать заявки', flags: { owner: true, accountant: true, viewer: false } },
  { label: 'Загружать документы', flags: { owner: true, accountant: true, viewer: false } },
  { label: 'Видеть финансы', flags: { owner: true, accountant: true, viewer: false } },
  { label: 'Принимать условия', flags: { owner: true, accountant: false, viewer: false } },
  { label: 'Управлять командой', flags: { owner: true, accountant: false, viewer: false } },
  { label: 'Просмотр заявок', flags: { owner: true, accountant: true, viewer: true } },
]

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
  const navigate = useNavigate()
  const { user } = useAuth()
  const { companyId: storeCompanyId, company } = useAppStore()
  const qc = useQueryClient()
  const companyId = storeCompanyId || user?.companyId
  const companyName = company?.name || 'Компания'

  const membersQ = useQuery({
    queryKey: ['team', 'members', companyId],
    queryFn: () => listMembers(companyId!),
    enabled: Boolean(companyId),
  })
  const invitesQ = useQuery({
    queryKey: ['team', 'invites', companyId],
    queryFn: () => listInvites(companyId!),
    enabled: Boolean(companyId),
  })

  const members = useMemo(() => {
    const list = membersQ.data ?? []
    const emails = new Set(list.map((m) => m.email.toLowerCase()))
    const invited = (invitesQ.data ?? [])
      .map(inviteToMember)
      .filter((m) => m.email && !emails.has(m.email.toLowerCase()))
    return [...list, ...invited]
  }, [membersQ.data, invitesQ.data])

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | TeamRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TeamStatus>('all')
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const activeCount = members.filter((m) => m.status === 'active').length
  const invitedCount = members.filter((m) => m.status === 'invited').length
  const showMatrix = shouldShowRoleMatrix(members)
  const matrixRoles = assignedRoles(members)
  const loading = membersQ.isLoading || invitesQ.isLoading

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!q) return true
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })
  }, [members, search, roleFilter, statusFilter])

  function removeMember(id: string) {
    setMembers(removeTeamMember(id))
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
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate('/app/team/tasks')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              px: 2,
              py: 1.1,
            }}
          >
            Совместные задачи
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/team/invite')}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              px: 2.25,
              py: 1.1,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Пригласить сотрудника
          </Button>
        </Stack>
      </Stack>

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

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
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
                onClick={() => navigate(`/app/team/${m.id}`)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(11,31,53,0.02)' },
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
                      e.stopPropagation()
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
          onClick={() => {
            if (!menuId) return
            navigate(`/app/team/${menuId}`)
            setMenuAnchor(null)
            setMenuId(null)
          }}
        >
          Сменить роль
        </MenuItem>
        <MenuItem
          disabled={members.find((m) => m.id === menuId)?.role === 'owner'}
          onClick={() => menuId && removeMember(menuId)}
        >
          Отозвать доступ
        </MenuItem>
      </Menu>

      {showMatrix && (
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
          <Typography sx={{ fontSize: 13, color: '#7A8795', mb: 1.75, lineHeight: 1.45 }}>
            Показаны только роли, которые уже назначены участникам команды.
          </Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ ...thSx, fontSize: 11.5 }}>
                  Возможность
                </Box>
                {matrixRoles.map((role, i) => (
                  <Box
                    component="th"
                    key={role}
                    sx={{
                      ...thSx,
                      textAlign: 'center',
                      pr: i === matrixRoles.length - 1 ? 0 : 1.5,
                      fontSize: 11.5,
                    }}
                  >
                    {ROLE_LABEL[role]}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {MATRIX_ROWS.map((row) => (
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
                  {matrixRoles.map((role) => (
                    <Box component="td" key={role} sx={{ textAlign: 'center' }}>
                      <MatrixIcon ok={row.flags[role]} />
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
