import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAuditEvents, type AuditEvent } from '@/api/admin'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'
import { formatDateTime } from '@/utils/format'

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
  actorId: string
  action: ActionKind
  objectKind: ObjectKind
  objectLabel: string
  change: string
  ip: string
  result: ResultKind
  highlight?: boolean
  createdAt?: string
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

const ENTITY_TYPE: Record<ObjectKind, string | undefined> = {
  policy: 'credit_policy',
  application: 'application',
  catalog: 'credit_product',
  user: 'user',
  model: 'model',
  system: undefined,
}

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
    const body = err.response?.data as { message?: string } | undefined
    if (body?.message) return body.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

function inferAction(action: string): ActionKind {
  const a = action.toLowerCase()
  if (/(create|invite|seed)/.test(a)) return 'create'
  if (/(decision|decide|approve|reject|counteroffer)/.test(a)) return 'decision'
  if (/(login|access|auth|disable|enable|session)/.test(a)) return 'access'
  if (/(config|runtime)/.test(a)) return 'config'
  if (/(document|doc)/.test(a)) return 'document'
  if (/model/.test(a)) return 'model'
  if (/request/.test(a)) return 'request'
  if (/(data|reset|demo)/.test(a)) return 'data'
  return 'change'
}

function inferObjectKind(entityType: string): ObjectKind {
  const e = entityType.toLowerCase()
  if (e.includes('policy')) return 'policy'
  if (e.includes('application')) return 'application'
  if (e.includes('product') || e.includes('catalog')) return 'catalog'
  if (e.includes('user') || e.includes('member')) return 'user'
  if (e.includes('model')) return 'model'
  return 'system'
}

function mapAudit(e: AuditEvent): AuditRow {
  const details = e.details ?? {}
  return {
    id: e.id,
    at: e.createdAt ? formatDateTime(e.createdAt) : '—',
    actorId: e.actorLogin || e.actorId || 'system',
    action: inferAction(e.action),
    objectKind: inferObjectKind(e.entityType),
    objectLabel: `${e.entityType} ${e.entityId ?? ''}`.trim(),
    change: JSON.stringify(details).slice(0, 120),
    ip: typeof details.ip === 'string' ? details.ip : '—',
    result: 'success',
    createdAt: e.createdAt,
  }
}

function exportCsv(rows: AuditRow[]) {
  const cols = ['at', 'actorId', 'action', 'objectLabel', 'change', 'ip', 'result'] as const
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    cols.join(','),
    ...rows.map((r) => cols.map((k) => esc(String(r[k] ?? ''))).join(',')),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'audit.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminAuditPage() {
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [action, setAction] = useState('all')
  const [objectKind, setObjectKind] = useState('all')
  const [period, setPeriod] = useState('7')
  const [integrityMsg, setIntegrityMsg] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300)
    return () => window.clearTimeout(t)
  }, [q])

  const entityType =
    objectKind === 'all' ? undefined : ENTITY_TYPE[objectKind as ObjectKind]

  const auditQ = useQuery({
    queryKey: ['admin', 'audit', { q: qDebounced, action, entityType }],
    queryFn: () =>
      listAuditEvents({
        q: qDebounced || undefined,
        limit: 100,
        entityType,
      }),
  })

  const rows = useMemo(() => {
    const mapped = (auditQ.data?.items ?? []).map(mapAudit)
    const days = Number(period) || 0
    const fetchedAt = auditQ.dataUpdatedAt || 0
    const maxAge = days ? days * 86_400_000 : 0
    return mapped.filter((e) => {
      if (action !== 'all' && e.action !== action) return false
      if (objectKind !== 'all' && e.objectKind !== objectKind) return false
      if (maxAge && fetchedAt && e.createdAt) {
        const t = new Date(e.createdAt).getTime()
        if (!Number.isNaN(t) && fetchedAt - t > maxAge) return false
      }
      if (!qDebounced) return true
      const needle = qDebounced.toLowerCase()
      return (
        e.actorId.toLowerCase().includes(needle) ||
        e.objectLabel.toLowerCase().includes(needle) ||
        e.change.toLowerCase().includes(needle) ||
        e.id.toLowerCase().includes(needle) ||
        e.ip.toLowerCase().includes(needle)
      )
    })
  }, [auditQ.data, auditQ.dataUpdatedAt, action, objectKind, period, qDebounced])

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
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
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
                setIntegrityMsg(
                  `Записей в журнале: ${(auditQ.data?.total ?? rows.length).toLocaleString('ru-RU')} · выгрузка актуальна`,
                )
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

      {auditQ.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => auditQ.refetch()}>
              Повторить
            </Button>
          }
        >
          {apiError(auditQ.error, 'Не удалось загрузить журнал аудита')}
        </Alert>
      )}
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
        {auditQ.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: color.primary.main }} />
          </Box>
        ) : (
          <>
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
                {rows.map((e) => {
                  const am = actionMeta[e.action]
                  return (
                    <TableRow
                      key={e.id}
                      hover
                      sx={e.highlight ? { bgcolor: color.primary.soft04 } : undefined}
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
                {rows.length === 0 && (
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
              Показано {rows.length.toLocaleString('ru-RU')} из{' '}
              {(auditQ.data?.total ?? rows.length).toLocaleString('ru-RU')} записей
            </Typography>
          </>
        )}
      </Box>
    </Box>
  )
}
