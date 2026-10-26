import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import dayjs from 'dayjs'
import { listDocumentReviews } from '@/api/docReviews'
import { listMembers } from '@/api/team'
import {
  createCompanyTask,
  listCompanyTasks,
  patchCompanyTask,
  type CompanyTask,
  type TaskStatus,
} from '@/api/tasks'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'

type ColumnId = 'todo' | 'doing' | 'done'
type DueTone = 'danger' | 'warn' | 'neutral' | 'success'

type UiTask = {
  id: string
  title: string
  description?: string
  assignee: string
  initials: string
  dueLabel: string
  dueTone: DueTone
  mine: boolean
  overdue: boolean
  column: ColumnId
  dueDate?: string
}

const COLUMNS: { id: ColumnId; title: string; dot: string; status: TaskStatus }[] = [
  { id: 'todo', title: 'К выполнению', dot: '#5A6B7D', status: 'todo' },
  { id: 'doing', title: 'В работе', dot: '#EF3124', status: 'in_progress' },
  { id: 'done', title: 'Выполнено', dot: '#1B8A5A', status: 'done' },
]

const DUE_STYLE: Record<DueTone, { bg: string; color: string }> = {
  danger: { bg: '#FDE8E6', color: '#C41E14' },
  warn: { bg: '#FFF0E0', color: '#C45A12' },
  neutral: { bg: '#EEF1F4', color: '#5A6B7D' },
  success: { bg: '#E6F5EE', color: '#1B8A5A' },
}

type Filter = 'all' | 'mine' | 'overdue'

function initialsOf(name?: string): string {
  if (!name) return '??'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function statusToColumn(status: TaskStatus): ColumnId {
  if (status === 'in_progress') return 'doing'
  if (status === 'done') return 'done'
  return 'todo'
}

function columnToStatus(col: ColumnId): TaskStatus {
  if (col === 'doing') return 'in_progress'
  if (col === 'done') return 'done'
  return 'todo'
}

function mapUiTask(t: CompanyTask, myUserId?: string): UiTask {
  const due = t.dueDate ? dayjs(t.dueDate) : null
  const done = t.status === 'done'
  const overdue = Boolean(due && !done && due.isBefore(dayjs(), 'day'))
  const days = due ? due.diff(dayjs(), 'day') : null
  let dueTone: DueTone = 'neutral'
  let dueLabel = 'без срока'
  if (done) {
    dueTone = 'success'
    dueLabel = due ? due.format('DD.MM') : 'готово'
  } else if (due) {
    dueLabel = `до ${due.format('DD.MM')}`
    if (overdue || (days != null && days <= 1)) dueTone = 'danger'
    else if (days != null && days <= 3) dueTone = 'warn'
  }
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    assignee: t.assigneeName || t.assigneeEmail || 'Не назначен',
    initials: initialsOf(t.assigneeName || t.assigneeEmail),
    dueLabel,
    dueTone,
    mine: Boolean(myUserId && t.assigneeUserId === myUserId),
    overdue,
    column: statusToColumn(t.status),
    dueDate: t.dueDate,
  }
}

function isDocsTask(task: UiTask): boolean {
  const blob = `${task.title} ${task.description || ''}`.toLowerCase()
  return /документ|заявк|договор|согласован|провер|отчёт|отчет/.test(blob)
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

export function TeamTasksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { companyId: storeCompanyId } = useAppStore()
  const companyId = storeCompanyId || user?.companyId
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ColumnId | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [newDue, setNewDue] = useState(() => dayjs().add(3, 'day').format('YYYY-MM-DD'))
  const [error, setError] = useState<string | null>(null)
  const dragMoved = useRef(false)

  const tasksQ = useQuery({
    queryKey: ['tasks', companyId],
    queryFn: () => listCompanyTasks(companyId!),
    enabled: Boolean(companyId),
  })
  const membersQ = useQuery({
    queryKey: ['team', 'members', companyId],
    queryFn: () => listMembers(companyId!),
    enabled: Boolean(companyId),
  })
  const reviewsQ = useQuery({
    queryKey: ['doc-reviews', companyId],
    queryFn: () => listDocumentReviews(companyId!),
    enabled: Boolean(companyId),
  })

  function openTaskDocuments(task: UiTask) {
    if (dragMoved.current) return
    const reviews = (reviewsQ.data ?? []).filter((r) => r.taskId === task.id)
    const agreement = reviews.find((r) => r.kind === 'agreement')
    if (agreement?.applicationId) {
      navigate(`/app/applications/${agreement.applicationId}/contract`)
      return
    }
    if (isDocsTask(task) || reviews.length > 0) {
      navigate('/app/documents?tab=review')
    }
  }

  const tasks = useMemo(
    () => (tasksQ.data ?? []).map((t) => mapUiTask(t, user?.id)),
    [tasksQ.data, user?.id],
  )

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'mine') return t.mine
      if (filter === 'overdue') return t.overdue && t.column !== 'done'
      return true
    })
  }, [tasks, filter])

  const moveM = useMutation({
    mutationFn: ({ id, column }: { id: string; column: ColumnId }) =>
      patchCompanyTask(companyId!, id, { status: columnToStatus(column) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      await qc.invalidateQueries({ queryKey: ['obligations', companyId] })
      setError(null)
    },
    onError: (err) => setError(apiError(err, 'Не удалось переместить задачу')),
  })

  const createM = useMutation({
    mutationFn: () => {
      if (!newAssigneeId) throw new Error('Выберите исполнителя из команды')
      return createCompanyTask(companyId!, {
        title: newTitle.trim(),
        assigneeUserId: newAssigneeId,
        dueDate: newDue || undefined,
        status: 'todo',
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      await qc.invalidateQueries({ queryKey: ['obligations', companyId] })
      await qc.invalidateQueries({ queryKey: ['notifications'] })
      setNewTitle('')
      setCreateOpen(false)
      setError(null)
    },
    onError: (err) => setError(apiError(err, 'Не удалось создать задачу')),
  })

  function moveTask(taskId: string, column: ColumnId) {
    if (!companyId) return
    const current = tasks.find((t) => t.id === taskId)
    if (!current || current.column === column) return
    moveM.mutate({ id: taskId, column })
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'mine', label: 'Мои' },
    { key: 'overdue', label: 'Просроченные' },
  ]

  const members = useMemo(
    () =>
      (membersQ.data ?? []).filter(
        (m) => m.source !== 'invite' && m.status === 'active' && Boolean(m.id),
      ),
    [membersQ.data],
  )

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 3 }}>
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
          Совместные задачи
        </Box>
      </Typography>

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
            Совместные задачи
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 13.5, mt: 0.5 }}>
            Назначение уходит исполнителю в уведомления; дедлайн — в календарь
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddRoundedIcon />}
          disabled={!companyId}
          onClick={() => {
            if (!newAssigneeId && members[0]) setNewAssigneeId(members[0].id)
            setCreateOpen(true)
          }}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            alignSelf: 'flex-start',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          Новая задача
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
        {filters.map((f) => {
          const active = filter === f.key
          return (
            <Button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                px: 1.75,
                py: 0.55,
                minHeight: 0,
                color: active ? '#fff' : '#5A6B7D',
                bgcolor: active ? '#3D4F5F' : '#fff',
                border: active ? '1px solid #3D4F5F' : '1px solid rgba(11,31,53,0.12)',
                '&:hover': {
                  bgcolor: active ? '#334552' : 'rgba(11,31,53,0.04)',
                },
              }}
            >
              {f.label}
            </Button>
          )
        })}
      </Stack>

      {!companyId && (
        <Alert severity="warning" sx={{ borderRadius: 2.5 }}>
          Выберите компанию, чтобы работать с задачами
        </Alert>
      )}

      {companyId && tasksQ.isLoading && (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={28} sx={{ color: '#EF3124' }} />
        </Box>
      )}

      {companyId && !tasksQ.isLoading && (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            alignItems: 'start',
          }}
        >
          {COLUMNS.map((col) => {
            const colTasks = visible.filter((t) => t.column === col.id)
            const isOver = overCol === col.id && dragId != null

            return (
              <Box
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverCol(col.id)
                }}
                onDragLeave={() => {
                  setOverCol((c) => (c === col.id ? null : c))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/task-id') || dragId
                  if (id) moveTask(id, col.id)
                  setDragId(null)
                  setOverCol(null)
                }}
                sx={{
                  bgcolor: isOver ? 'rgba(239,49,36,0.04)' : '#EEF1F4',
                  borderRadius: 3,
                  p: 1.5,
                  minHeight: 420,
                  border: isOver ? '1.5px solid rgba(239,49,36,0.35)' : '1.5px solid transparent',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, px: 0.25 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: col.dot,
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0B1F35', flex: 1 }}>
                    {col.title}
                  </Typography>
                  <Box
                    sx={{
                      minWidth: 22,
                      height: 22,
                      px: 0.6,
                      borderRadius: 999,
                      bgcolor: '#fff',
                      color: '#5A6B7D',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {colTasks.length}
                  </Box>
                </Stack>

                <Stack spacing={1.15}>
                  {colTasks.map((task) => (
                    <Box
                      key={task.id}
                      draggable
                      role="button"
                      tabIndex={0}
                      onClick={() => openTaskDocuments(task)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openTaskDocuments(task)
                        }
                      }}
                      onDragStart={(e) => {
                        dragMoved.current = true
                        setDragId(task.id)
                        e.dataTransfer.setData('text/task-id', task.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCol(null)
                        window.setTimeout(() => {
                          dragMoved.current = false
                        }, 0)
                      }}
                      sx={{
                        bgcolor: '#fff',
                        borderRadius: 2.5,
                        p: 1.5,
                        border: '1px solid rgba(11,31,53,0.06)',
                        boxShadow: '0 1px 6px rgba(11,31,53,0.04)',
                        cursor: isDocsTask(task) ? 'pointer' : 'grab',
                        opacity: dragId === task.id ? 0.55 : 1,
                        '&:active': { cursor: 'grabbing' },
                        '&:hover': { borderColor: 'rgba(11,31,53,0.14)' },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#0B1F35',
                          lineHeight: 1.35,
                          mb: 1.25,
                        }}
                      >
                        {task.title}
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            bgcolor: '#E8ECF0',
                            color: '#5A6B7D',
                            fontSize: 10,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {task.initials}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            color: '#5A6B7D',
                            fontWeight: 600,
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {task.assignee}
                        </Typography>
                        <Box
                          component="span"
                          sx={{
                            px: 0.85,
                            py: 0.3,
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            bgcolor: DUE_STYLE[task.dueTone].bg,
                            color: DUE_STYLE[task.dueTone].color,
                          }}
                        >
                          {task.dueLabel}
                        </Box>
                      </Stack>
                    </Box>
                  ))}

                  {col.id === 'todo' && (
                    <Box
                      onClick={() => setCreateOpen(true)}
                      sx={{
                        mt: 0.25,
                        borderRadius: 2.5,
                        border: '1.5px dashed rgba(11,31,53,0.18)',
                        bgcolor: isOver ? 'rgba(239,49,36,0.03)' : 'transparent',
                        px: 1.5,
                        py: 2.25,
                        textAlign: 'center',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: 'rgba(239,49,36,0.4)',
                          bgcolor: 'rgba(239,49,36,0.02)',
                        },
                      }}
                    >
                      <DescriptionOutlinedIcon sx={{ fontSize: 22, color: '#9AA5B1', mb: 0.75 }} />
                      <Typography
                        sx={{ fontSize: 12.5, color: '#9AA5B1', lineHeight: 1.4, fontWeight: 600 }}
                      >
                        Перетащите задачу сюда
                        <br />
                        или создайте новую
                      </Typography>
                    </Box>
                  )}

                  {col.id !== 'todo' && colTasks.length === 0 && (
                    <Box
                      sx={{
                        borderRadius: 2.5,
                        border: '1.5px dashed rgba(11,31,53,0.14)',
                        px: 1.5,
                        py: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', fontWeight: 600 }}>
                        Перетащите задачу сюда
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )
          })}
        </Box>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 2.5 } }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 18,
            color: '#0B1F35',
            mb: 2,
          }}
        >
          Новая задача
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Название"
            size="small"
            fullWidth
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Что нужно сделать"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField
            select
            label="Исполнитель"
            size="small"
            fullWidth
            value={newAssigneeId}
            onChange={(e) => setNewAssigneeId(e.target.value)}
            disabled={membersQ.isLoading || members.length === 0}
            helperText={
              membersQ.isLoading
                ? 'Загрузка участников…'
                : members.length === 0
                  ? 'Нет участников команды — сначала пригласите и дождитесь принятия'
                  : 'Только принятые участники компании'
            }
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
                {m.email ? ` · ${m.email}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Дедлайн"
            size="small"
            fullWidth
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Stack direction="row" spacing={1.25} sx={{ pt: 0.5 }}>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={() => setCreateOpen(false)}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
            >
              Отмена
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              disabled={
                !newTitle.trim() ||
                !newAssigneeId ||
                createM.isPending ||
                !companyId ||
                members.length === 0
              }
              onClick={() => createM.mutate()}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 'none',
              }}
            >
              {createM.isPending ? '…' : 'Создать'}
            </Button>
          </Stack>
        </Stack>
      </Dialog>
    </Box>
  )
}
