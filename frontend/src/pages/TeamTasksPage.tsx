import {
  Box,
  Button,
  Dialog,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

type ColumnId = 'todo' | 'doing' | 'done'
type DueTone = 'danger' | 'warn' | 'neutral' | 'success'

type Task = {
  id: string
  title: string
  assignee: string
  initials: string
  dueLabel: string
  dueTone: DueTone
  mine: boolean
  overdue: boolean
  column: ColumnId
}

const COLUMNS: {
  id: ColumnId
  title: string
  dot: string
}[] = [
  { id: 'todo', title: 'К выполнению', dot: '#5A6B7D' },
  { id: 'doing', title: 'В работе', dot: '#EF3124' },
  { id: 'done', title: 'Выполнено', dot: '#1B8A5A' },
]

const INITIAL: Task[] = [
  {
    id: 't1',
    title: 'Пояснение к платежу 14.01',
    assignee: 'Лебедева И.О.',
    initials: 'ЛИ',
    dueLabel: 'до 25.10',
    dueTone: 'danger',
    mine: false,
    overdue: true,
    column: 'todo',
  },
  {
    id: 't2',
    title: 'Выписка за сентябрь',
    assignee: 'Лебедева И.О.',
    initials: 'ЛИ',
    dueLabel: 'до 25.10',
    dueTone: 'warn',
    mine: false,
    overdue: false,
    column: 'todo',
  },
  {
    id: 't3',
    title: 'Ответить на предложение банка',
    assignee: 'Миронов С.П.',
    initials: 'СМ',
    dueLabel: 'до 27.10',
    dueTone: 'danger',
    mine: true,
    overdue: true,
    column: 'todo',
  },
  {
    id: 't4',
    title: 'Подготовить договор поставки для приложения',
    assignee: 'Громов А.В.',
    initials: 'АГ',
    dueLabel: 'до 26.10',
    dueTone: 'neutral',
    mine: false,
    overdue: false,
    column: 'doing',
  },
  {
    id: 't5',
    title: 'Проверить график платежей',
    assignee: 'Миронов С.П.',
    initials: 'СМ',
    dueLabel: 'до 27.10',
    dueTone: 'neutral',
    mine: true,
    overdue: false,
    column: 'doing',
  },
  {
    id: 't6',
    title: 'Загрузить договор аренды',
    assignee: 'Лебедева И.О.',
    initials: 'ЛИ',
    dueLabel: '22.10',
    dueTone: 'success',
    mine: false,
    overdue: false,
    column: 'done',
  },
]

const DUE_STYLE: Record<DueTone, { bg: string; color: string }> = {
  danger: { bg: '#FDE8E6', color: '#C41E14' },
  warn: { bg: '#FFF0E0', color: '#C45A12' },
  neutral: { bg: '#EEF1F4', color: '#5A6B7D' },
  success: { bg: '#E6F5EE', color: '#1B8A5A' },
}

type Filter = 'all' | 'mine' | 'overdue'

export function TeamTasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState(INITIAL)
  const [filter, setFilter] = useState<Filter>('all')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ColumnId | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('Миронов С.П.')

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'mine') return t.mine
      if (filter === 'overdue') return t.overdue && t.column !== 'done'
      return true
    })
  }, [tasks, filter])

  function moveTask(taskId: string, column: ColumnId) {
    setTasks((list) =>
      list.map((t) => {
        if (t.id !== taskId) return t
        const next = { ...t, column }
        if (column === 'done') {
          next.dueTone = 'success'
          next.dueLabel = new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
          })
          next.overdue = false
        }
        return next
      }),
    )
  }

  function createTask() {
    const title = newTitle.trim()
    if (!title) return
    const initials = newAssignee
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    const mine = Boolean(user?.fullName && newAssignee.includes(user.fullName.split(' ')[0] ?? ''))
    setTasks((list) => [
      {
        id: `t_${Date.now()}`,
        title,
        assignee: newAssignee,
        initials: initials || '??',
        dueLabel: 'до 30.10',
        dueTone: 'neutral',
        mine: mine || newAssignee.startsWith('Миронов'),
        overdue: false,
        column: 'todo',
      },
      ...list,
    ])
    setNewTitle('')
    setCreateOpen(false)
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'mine', label: 'Мои' },
    { key: 'overdue', label: 'Просроченные' },
  ]

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
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddRoundedIcon />}
          onClick={() => setCreateOpen(true)}
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
                    onDragStart={(e) => {
                      setDragId(task.id)
                      e.dataTransfer.setData('text/task-id', task.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverCol(null)
                    }}
                    sx={{
                      bgcolor: '#fff',
                      borderRadius: 2.5,
                      p: 1.5,
                      border: '1px solid rgba(11,31,53,0.06)',
                      boxShadow: '0 1px 6px rgba(11,31,53,0.04)',
                      cursor: 'grab',
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
                      '&:hover': { borderColor: 'rgba(239,49,36,0.4)', bgcolor: 'rgba(239,49,36,0.02)' },
                    }}
                  >
                    <DescriptionOutlinedIcon sx={{ fontSize: 22, color: '#9AA5B1', mb: 0.75 }} />
                    <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', lineHeight: 1.4, fontWeight: 600 }}>
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
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            <MenuItem value="Миронов С.П.">Миронов С.П.</MenuItem>
            <MenuItem value="Лебедева И.О.">Лебедева И.О.</MenuItem>
            <MenuItem value="Громов А.В.">Громов А.В.</MenuItem>
            <MenuItem value="Игорь Петров">Игорь Петров</MenuItem>
          </TextField>
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
              disabled={!newTitle.trim()}
              onClick={createTask}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 'none',
              }}
            >
              Создать
            </Button>
          </Stack>
        </Stack>
      </Dialog>
    </Box>
  )
}
