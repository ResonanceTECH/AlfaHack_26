import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

type ActionKind =
  | 'change'
  | 'create'
  | 'access'
  | 'config'
  | 'decision'
  | 'document'
  | 'request'
  | 'data'
  | 'model'

type ObjectKind = 'policy' | 'application' | 'catalog' | 'user' | 'system' | 'model'

type ResultKind = 'success' | 'block'

type AuditRow = {
  id: string
  at: string
  /** ID актора (не ФИО) */
  actorId: string
  action: ActionKind
  objectKind: ObjectKind
  objectLabel: string
  change: string
  ip: string
  result: ResultKind
  highlight?: boolean
}

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

const actionMeta: Record<ActionKind, { label: string; bgcolor: string; color: string }> = {
  change: {
    label: 'Изменение',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  create: {
    label: 'Создание',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  access: {
    label: 'Доступ',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  config: {
    label: 'Конфиг',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  decision: {
    label: 'Решение',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
  document: {
    label: 'Документ',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
  request: {
    label: 'Запрос',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
  data: {
    label: 'Данные',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
  model: {
    label: 'Модель',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
}

const ENTRIES: AuditRow[] = [
  {
    id: 'aud_001',
    at: '23.10 10:02',
    actorId: 'user_admin_01',
    action: 'change',
    objectKind: 'policy',
    objectLabel: 'Политика v13 · R-212',
    change: 'dscr < 1.2 → dscr < 1.3',
    ip: '10.20.14.7',
    result: 'success',
    highlight: true,
  },
  {
    id: 'aud_002',
    at: '23.10 09:48',
    actorId: 'user_mgr_02',
    action: 'decision',
    objectKind: 'application',
    objectLabel: 'ABC-2026-1042',
    change: 'in_review → approved',
    ip: '10.20.14.22',
    result: 'success',
  },
  {
    id: 'aud_003',
    at: '23.10 09:31',
    actorId: 'user_admin_01',
    action: 'config',
    objectKind: 'catalog',
    objectLabel: 'Каталог · P-101',
    change: 'rateFrom 17.1 → 17.3',
    ip: '10.20.14.7',
    result: 'success',
  },
  {
    id: 'aud_004',
    at: '23.10 09:12',
    actorId: 'system',
    action: 'model',
    objectKind: 'model',
    objectLabel: 'score_v4.2',
    change: 'PSI drift alert 0.11',
    ip: '—',
    result: 'success',
  },
  {
    id: 'aud_005',
    at: '23.10 08:55',
    actorId: 'user_analyst_01',
    action: 'document',
    objectKind: 'application',
    objectLabel: 'ABC-2026-1038',
    change: 'request docs: supplier_contract',
    ip: '10.20.15.3',
    result: 'success',
  },
  {
    id: 'aud_006',
    at: '23.10 08:40',
    actorId: 'user_mgr_04',
    action: 'access',
    objectKind: 'user',
    objectLabel: 'user_mgr_04',
    change: '3 неудачных попытки входа',
    ip: '185.12.4.90',
    result: 'block',
  },
  {
    id: 'aud_007',
    at: '22.10 19:05',
    actorId: 'user_admin_01',
    action: 'change',
    objectKind: 'user',
    objectLabel: 'user_mgr_04',
    change: 'role: entrepreneur → analyst',
    ip: '10.20.14.7',
    result: 'success',
  },
  {
    id: 'aud_008',
    at: '22.10 18:22',
    actorId: 'user_admin_01',
    action: 'access',
    objectKind: 'user',
    objectLabel: 'user_sokolova',
    change: 'status: active → disabled',
    ip: '10.20.14.7',
    result: 'success',
  },
  {
    id: 'aud_009',
    at: '22.10 16:10',
    actorId: 'system',
    action: 'data',
    objectKind: 'system',
    objectLabel: 'demo_seed',
    change: 'refresh synthetic datasets',
    ip: '—',
    result: 'success',
  },
  {
    id: 'aud_010',
    at: '22.10 14:48',
    actorId: 'user_mgr_02',
    action: 'create',
    objectKind: 'application',
    objectLabel: 'ABC-2026-1051',
    change: 'draft → submitted',
    ip: '10.20.14.22',
    result: 'success',
  },
  {
    id: 'aud_011',
    at: '22.10 12:03',
    actorId: 'unknown',
    action: 'request',
    objectKind: 'system',
    objectLabel: '/api/v1/auth/login',
    change: 'invalid refresh token',
    ip: '91.44.2.11',
    result: 'block',
  },
  {
    id: 'aud_012',
    at: '21.10 11:08',
    actorId: 'user_admin_01',
    action: 'create',
    objectKind: 'policy',
    objectLabel: 'Политика · R-208',
    change: 'publish stop-factor overdue',
    ip: '10.20.14.7',
    result: 'success',
  },
]

export function AdminAuditPage() {
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')
  const [objectKind, setObjectKind] = useState('all')
  const [period, setPeriod] = useState('7')
  const [integrityMsg, setIntegrityMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ENTRIES.filter((e) => {
      if (action !== 'all' && e.action !== action) return false
      if (objectKind !== 'all' && e.objectKind !== objectKind) return false
      if (!needle) return true
      return (
        e.actorId.toLowerCase().includes(needle) ||
        e.objectLabel.toLowerCase().includes(needle) ||
        e.change.toLowerCase().includes(needle) ||
        e.id.toLowerCase().includes(needle) ||
        e.ip.toLowerCase().includes(needle)
      )
    })
  }, [q, action, objectKind])

  return (
    <Box>
      <PageHeader
        title="Аудит изменений"
        subtitle="Неизменяемый журнал действий сотрудников и системы"
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
              Экспорт CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<VerifiedUserOutlinedIcon />}
              onClick={() =>
                setIntegrityMsg('Хэш-цепочка целостна · 1 842 записи · проверено сейчас')
              }
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Проверить целостность
            </Button>
          </>
        }
      />

      {integrityMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setIntegrityMsg(null)}>
          {integrityMsg}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ mb: 2 }}
        useFlexGap
        flexWrap="wrap"
      >
        <TextField
          size="small"
          placeholder="ID актора, объект или запись"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: { xs: '100%', md: 280 }, flex: 1 }}
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
          label="Тип"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">Все</MenuItem>
          {(Object.keys(actionMeta) as ActionKind[]).map((k) => (
            <MenuItem key={k} value={k}>
              {actionMeta[k].label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Объект"
          value={objectKind}
          onChange={(e) => setObjectKind(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="policy">Политика</MenuItem>
          <MenuItem value="application">Заявка</MenuItem>
          <MenuItem value="catalog">Каталог</MenuItem>
          <MenuItem value="user">Пользователь</MenuItem>
          <MenuItem value="model">Модель</MenuItem>
          <MenuItem value="system">Система</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Период"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="1">1 день</MenuItem>
          <MenuItem value="7">7 дней</MenuItem>
          <MenuItem value="30">30 дней</MenuItem>
          <MenuItem value="90">90 дней</MenuItem>
        </TextField>
      </Stack>

      <Box sx={{ ...tileSx, overflow: 'auto' }}>
        <Table size="small" sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Время</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>ID актора</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Действие</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Объект</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Изменение</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>IP</TableCell>
              <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Результат</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((e) => {
              const am = actionMeta[e.action]
              return (
                <TableRow
                  key={e.id}
                  hover
                  sx={
                    e.highlight
                      ? { bgcolor: color.primary.soft04 }
                      : undefined
                  }
                >
                  <TableCell>
                    <Typography sx={{ fontSize: 13, color: color.text.secondary, whiteSpace: 'nowrap' }}>
                      {e.at}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: font.mono,
                        color:
                          e.actorId === 'system' || e.actorId === 'unknown'
                            ? color.text.muted
                            : color.text.primary,
                      }}
                    >
                      {e.actorId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={am.label}
                      sx={{
                        bgcolor: am.bgcolor,
                        color: am.color,
                        fontWeight: 700,
                        fontSize: 11.5,
                        height: 24,
                        borderRadius: `${radius.chip}px`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: color.text.primary }}>
                      {e.objectLabel}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontFamily: font.mono,
                        color: color.text.secondary,
                        maxWidth: 280,
                      }}
                      noWrap
                      title={e.change}
                    >
                      {e.change}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{ fontSize: 12.5, fontFamily: font.mono, color: color.text.muted }}
                    >
                      {e.ip}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={e.result === 'success' ? 'Успех' : 'Блок'}
                      sx={{
                        bgcolor:
                          e.result === 'success'
                            ? 'rgba(27,138,90,0.1)'
                            : 'rgba(196,30,20,0.1)',
                        color:
                          e.result === 'success'
                            ? color.semantic.success
                            : color.semantic.error,
                        fontWeight: 700,
                        fontSize: 11.5,
                        height: 24,
                        borderRadius: `${radius.chip}px`,
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography sx={{ py: 3, textAlign: 'center', color: color.text.muted }}>
                    Нет записей по фильтрам
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Typography sx={{ mt: 1.75, fontSize: 12.5, color: color.text.muted }}>
          Показано {filtered.length.toLocaleString('ru-RU')} из 1 842 записей · хранение 5 лет ·
          хэш-цепочка проверена 23.10 06:00
        </Typography>
      </Box>

    </Box>
  )
}
