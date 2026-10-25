import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

/** Только 3 роли продукта (= backend UserRole). */
type StaffRole = 'entrepreneur' | 'analyst' | 'admin'
type UserStatus = 'active' | 'invited' | 'mfa_required' | 'disabled'

type DemoUser = {
  id: string
  name: string
  email: string
  role: StaffRole
  department: string
  mfa: boolean
  lastLogin: string
  status: UserStatus
  /** статус до блокировки — для разблокировки */
  statusBeforeBlock?: UserStatus
}

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'entrepreneur', label: 'Предприниматель' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'admin', label: 'Администратор' },
]

const roleMeta: Record<StaffRole, { label: string; bgcolor: string; color: string }> = {
  entrepreneur: {
    label: 'Предприниматель',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
  analyst: {
    label: 'Аналитик',
    bgcolor: color.secondary.main,
    color: color.text.onDark,
  },
  admin: {
    label: 'Администратор',
    bgcolor: color.primary.soft08,
    color: color.primary.main,
  },
}

const statusMeta: Record<UserStatus, { label: string; bgcolor: string; color: string }> = {
  active: {
    label: 'Активна',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  invited: {
    label: 'Приглашена',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  mfa_required: {
    label: 'MFA не вкл.',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  disabled: {
    label: 'Заблокирован',
    bgcolor: 'rgba(196,30,20,0.1)',
    color: color.semantic.error,
  },
}

const INITIAL_USERS: DemoUser[] = [
  {
    id: '1',
    name: 'Елена Орлова',
    email: 'admin@demo.alfa',
    role: 'admin',
    department: 'Платформа',
    mfa: true,
    lastLogin: 'Сегодня, 10:11',
    status: 'active',
  },
  {
    id: '2',
    name: 'Петров И.В.',
    email: 'analyst@demo.alfa',
    role: 'analyst',
    department: 'Кредитный конвейер',
    mfa: true,
    lastLogin: 'Вчера, 18:22',
    status: 'active',
  },
  {
    id: '3',
    name: 'Соколова М.К.',
    email: 'sokolova@demo.alfa',
    role: 'analyst',
    department: 'Кредитный конвейер',
    mfa: false,
    lastLogin: '21 окт, 14:05',
    status: 'mfa_required',
  },
  {
    id: '4',
    name: 'Кузнецов Д.А.',
    email: 'kuznetsov@demo.alfa',
    role: 'analyst',
    department: 'Риски',
    mfa: true,
    lastLogin: '20 окт, 11:30',
    status: 'active',
  },
  {
    id: '5',
    name: 'Новикова Е.П.',
    email: 'novikova@demo.alfa',
    role: 'analyst',
    department: 'Онбординг',
    mfa: false,
    lastLogin: '—',
    status: 'invited',
  },
  {
    id: '6',
    name: 'IP Демо',
    email: 'ip@demo.alfa',
    role: 'entrepreneur',
    department: 'Клиент',
    mfa: true,
    lastLogin: 'Сегодня, 08:15',
    status: 'active',
  },
  {
    id: '7',
    name: 'ООО Демо',
    email: 'ooo@demo.alfa',
    role: 'entrepreneur',
    department: 'Клиент',
    mfa: true,
    lastLogin: 'Вчера, 16:48',
    status: 'active',
  },
]

const PERMISSIONS: { label: string; cells: boolean[] }[] = [
  { label: 'Просмотр заявок компании', cells: [true, true, true] },
  { label: 'Решение по заявке (лимит 5 млн ₽)', cells: [false, true, true] },
  { label: 'Риск-заключение', cells: [false, true, true] },
  { label: 'Редактирование политики', cells: [false, false, true] },
  { label: 'Блокировка / смена роли', cells: [false, false, true] },
]

const ROLE_COLS = ['Предприниматель', 'Аналитик', 'Администратор'] as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}

export function AdminUsersPage() {
  const [users, setUsers] = useState(INITIAL_USERS)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [mfa, setMfa] = useState('any')
  const [selected, setSelected] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuUserId, setMenuUserId] = useState<string | null>(null)

  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleDraft, setRoleDraft] = useState<StaffRole>('analyst')
  const [roleTargetIds, setRoleTargetIds] = useState<string[]>([])

  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockTargetIds, setBlockTargetIds] = useState<string[]>([])
  const [blockMode, setBlockMode] = useState<'block' | 'unblock'>('block')

  const menuUser = users.find((u) => u.id === menuUserId) ?? null

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return users.filter((u) => {
      if (role !== 'all' && u.role !== role) return false
      if (status !== 'all' && u.status !== status) return false
      if (mfa === 'on' && !u.mfa) return false
      if (mfa === 'off' && u.mfa) return false
      if (!needle) return true
      return (
        u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)
      )
    })
  }, [users, q, role, status, mfa])

  const allChecked = filtered.length > 0 && filtered.every((u) => selected.includes(u.id))
  const someChecked = filtered.some((u) => selected.includes(u.id)) && !allChecked

  const summary = useMemo(() => {
    const activeLike = users.filter((u) => u.status !== 'disabled').length
    const mfaOn = users.filter((u) => u.mfa && u.status !== 'disabled').length
    const pct = activeLike ? Math.round((mfaOn / activeLike) * 100) : 0
    return { total: users.length, roles: 3, mfaPct: pct }
  }, [users])

  function toggleAll() {
    if (allChecked) {
      setSelected((prev) => prev.filter((id) => !filtered.some((u) => u.id === id)))
    } else {
      setSelected((prev) => [...new Set([...prev, ...filtered.map((u) => u.id)])])
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function openMenu(e: React.MouseEvent<HTMLElement>, id: string) {
    setMenuAnchor(e.currentTarget)
    setMenuUserId(id)
  }

  function closeMenu() {
    setMenuAnchor(null)
    setMenuUserId(null)
  }

  function openRoleDialog(ids: string[]) {
    const first = users.find((u) => u.id === ids[0])
    setRoleTargetIds(ids)
    setRoleDraft(first?.role ?? 'analyst')
    setRoleDialogOpen(true)
    closeMenu()
  }

  function applyRoleChange() {
    setUsers((prev) =>
      prev.map((u) => (roleTargetIds.includes(u.id) ? { ...u, role: roleDraft } : u)),
    )
    const n = roleTargetIds.length
    const label = roleMeta[roleDraft].label
    setToast(
      n === 1
        ? `Роль изменена → ${label}`
        : `Роль изменена у ${n} пользователей → ${label}`,
    )
    setRoleDialogOpen(false)
    setSelected([])
  }

  function openBlockDialog(ids: string[], mode: 'block' | 'unblock') {
    setBlockTargetIds(ids)
    setBlockMode(mode)
    setBlockDialogOpen(true)
    closeMenu()
  }

  function applyBlockChange() {
    setUsers((prev) =>
      prev.map((u) => {
        if (!blockTargetIds.includes(u.id)) return u
        if (blockMode === 'block') {
          if (u.status === 'disabled') return u
          return {
            ...u,
            statusBeforeBlock: u.status,
            status: 'disabled',
          }
        }
        return {
          ...u,
          status: u.statusBeforeBlock && u.statusBeforeBlock !== 'disabled' ? u.statusBeforeBlock : 'active',
          statusBeforeBlock: undefined,
        }
      }),
    )
    const n = blockTargetIds.length
    setToast(
      blockMode === 'block'
        ? n === 1
          ? 'Пользователь заблокирован'
          : `Заблокировано: ${n}`
        : n === 1
          ? 'Пользователь разблокирован'
          : `Разблокировано: ${n}`,
    )
    setBlockDialogOpen(false)
    setSelected([])
  }

  const selectedUsers = users.filter((u) => selected.includes(u.id))
  const canBulkBlock = selectedUsers.some((u) => u.status !== 'disabled')
  const canBulkUnblock = selectedUsers.some((u) => u.status === 'disabled')

  return (
    <Box>
      <PageHeader
        title="Пользователи и роли"
        subtitle={`${summary.total} пользователей · ${summary.roles} роли · MFA включена у ${summary.mfaPct}%`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Экспорт
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Пригласить
            </Button>
          </>
        }
      />

      {toast && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setToast(null)}>
          {toast}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ mb: 2 }}
        useFlexGap
        flexWrap="wrap"
        alignItems={{ md: 'center' }}
      >
        <TextField
          size="small"
          placeholder="Поиск по имени или email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: { xs: '100%', md: 260 }, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, color: color.text.muted }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Роль"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Все</MenuItem>
          {ROLE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="active">Активные</MenuItem>
          <MenuItem value="invited">Приглашённые</MenuItem>
          <MenuItem value="mfa_required">MFA не вкл.</MenuItem>
          <MenuItem value="disabled">Заблокированные</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="MFA"
          value={mfa}
          onChange={(e) => setMfa(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="any">Любая</MenuItem>
          <MenuItem value="on">Включена</MenuItem>
          <MenuItem value="off">Выключена</MenuItem>
        </TextField>
      </Stack>

      {selected.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 1.5,
            p: 1.25,
            borderRadius: 2,
            bgcolor: color.background.paper,
            border: `1px solid ${color.semantic.divider}`,
          }}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography sx={{ fontSize: 13, fontWeight: 650, mr: 1 }}>
            Выбрано: {selected.length}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ManageAccountsRoundedIcon />}
            onClick={() => openRoleDialog(selected)}
            sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
          >
            Сменить роль
          </Button>
          {canBulkBlock && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<BlockRoundedIcon />}
              onClick={() =>
                openBlockDialog(
                  selectedUsers.filter((u) => u.status !== 'disabled').map((u) => u.id),
                  'block',
                )
              }
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Заблокировать
            </Button>
          )}
          {canBulkUnblock && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockOpenRoundedIcon />}
              onClick={() =>
                openBlockDialog(
                  selectedUsers.filter((u) => u.status === 'disabled').map((u) => u.id),
                  'unblock',
                )
              }
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Разблокировать
            </Button>
          )}
        </Stack>
      )}

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
        <Table size="small" sx={{ minWidth: 880 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={toggleAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Пользователь</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Роль</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Подразделение</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }} align="center">
                MFA
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Последний вход</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Статус</TableCell>
              <TableCell width={48} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((u) => {
              const rm = roleMeta[u.role]
              const sm = statusMeta[u.status]
              const blocked = u.status === 'disabled'
              return (
                <TableRow
                  key={u.id}
                  hover
                  selected={selected.includes(u.id)}
                  sx={blocked ? { opacity: 0.72 } : undefined}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.includes(u.id)}
                      onChange={() => toggleOne(u.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: blocked
                            ? color.text.inactive
                            : u.role === 'admin'
                              ? color.primary.main
                              : color.secondary.main,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {initials(u.name)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: color.text.primary }}>
                          {u.name}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: color.text.muted }}>{u.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={rm.label}
                      sx={{
                        bgcolor: rm.bgcolor,
                        color: rm.color,
                        fontWeight: 700,
                        fontSize: 11.5,
                        height: 24,
                        borderRadius: `${radius.chip}px`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: color.text.primary }}>{u.department}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    {u.mfa ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 20, color: color.semantic.success }} />
                    ) : (
                      <CancelRoundedIcon sx={{ fontSize: 20, color: color.semantic.error }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: color.text.secondary }}>{u.lastLogin}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={sm.label}
                      sx={{
                        bgcolor: sm.bgcolor,
                        color: sm.color,
                        fontWeight: 700,
                        fontSize: 11.5,
                        height: 24,
                        borderRadius: `${radius.chip}px`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label="Действия"
                      onClick={(e) => openMenu(e, u.id)}
                    >
                      <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography sx={{ py: 3, textAlign: 'center', color: color.text.muted }}>
                    Никого не найдено по фильтрам
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => menuUser && openRoleDialog([menuUser.id])}
          disabled={!menuUser}
        >
          <ListItemIcon>
            <ManageAccountsRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Изменить роль</ListItemText>
        </MenuItem>
        {menuUser?.status === 'disabled' ? (
          <MenuItem onClick={() => menuUser && openBlockDialog([menuUser.id], 'unblock')}>
            <ListItemIcon>
              <LockOpenRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Разблокировать</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => menuUser && openBlockDialog([menuUser.id], 'block')}
            disabled={menuUser?.email === 'admin@demo.alfa'}
          >
            <ListItemIcon>
              <BlockRoundedIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Заблокировать</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Изменить роль</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: color.text.secondary, mb: 2 }}>
            {roleTargetIds.length === 1
              ? users.find((u) => u.id === roleTargetIds[0])?.email
              : `Пользователей: ${roleTargetIds.length}`}
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Новая роль"
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value as StaffRole)}
          >
            {ROLE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRoleDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={applyRoleChange}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {blockMode === 'block' ? 'Заблокировать пользователя' : 'Разблокировать пользователя'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: color.text.secondary }}>
            {blockMode === 'block'
              ? blockTargetIds.length === 1
                ? `Доступ для ${users.find((u) => u.id === blockTargetIds[0])?.email} будет отозван. Вход и API станут недоступны.`
                : `Будет заблокировано пользователей: ${blockTargetIds.length}.`
              : blockTargetIds.length === 1
                ? `Восстановить доступ для ${users.find((u) => u.id === blockTargetIds[0])?.email}?`
                : `Будет разблокировано: ${blockTargetIds.length}.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBlockDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            color={blockMode === 'block' ? 'error' : 'primary'}
            onClick={applyBlockChange}
          >
            {blockMode === 'block' ? 'Заблокировать' : 'Разблокировать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Typography
        sx={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 16,
          mb: 1.5,
          color: color.text.primary,
        }}
      >
        Права ролей
      </Typography>
      <Box sx={{ ...tileSx, overflow: 'auto' }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary, minWidth: 240 }}>
                Возможность
              </TableCell>
              {ROLE_COLS.map((c) => (
                <TableCell
                  key={c}
                  align="center"
                  sx={{ fontWeight: 700, color: color.text.secondary, whiteSpace: 'nowrap' }}
                >
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {PERMISSIONS.map((row) => (
              <TableRow key={row.label}>
                <TableCell>
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>{row.label}</Typography>
                </TableCell>
                {row.cells.map((ok, i) => (
                  <TableCell key={`${row.label}-${i}`} align="center">
                    {ok ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 20, color: color.semantic.success }} />
                    ) : (
                      <CancelRoundedIcon sx={{ fontSize: 20, color: color.text.inactive }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}
