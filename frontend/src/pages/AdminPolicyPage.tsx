import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  diffAdminPolicy,
  getAdminPolicy,
  listAdminPolicies,
  listAdminPolicyVersions,
  patchAdminPolicy,
  publishAdminPolicy,
  validateAdminPolicy,
  type AdminPolicy,
  type AdminPolicyVersion,
} from '@/api/admin'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

type RuleRow = {
  id: string
  condition: string
  action: string
  priority: number
  status: 'active' | 'changed' | 'new' | 'disabled'
}

const statusMeta: Record<RuleRow['status'], { label: string; bgcolor: string; color: string }> = {
  active: {
    label: 'Активно',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  changed: {
    label: 'Изменено',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  new: {
    label: 'Новое',
    bgcolor: color.primary.soft08,
    color: color.primary.main,
  },
  disabled: {
    label: 'Отключено',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
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

function rulesJson(rules: Record<string, unknown> | undefined): string {
  return JSON.stringify(rules ?? {}, null, 2)
}

function parseRules(dsl: string): Record<string, unknown> {
  const parsed = JSON.parse(dsl) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('rules must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

function pickPolicy(items: AdminPolicy[]): AdminPolicy | null {
  return items.find((p) => p.status.toUpperCase() === 'PUBLISHED') ?? items[0] ?? null
}

const EMPTY_RULES: Record<string, unknown> = {}

function flattenRules(rules: Record<string, unknown>): RuleRow[] {
  return Object.entries(rules).map(([key, value], i) => ({
    id: key,
    condition: typeof value === 'object' ? JSON.stringify(value) : String(value),
    action: typeof value === 'object' ? 'object' : typeof value,
    priority: i + 1,
    status: 'active' as const,
  }))
}

function versionLabel(v: AdminPolicyVersion): string {
  const date = v.createdAt
    ? new Date(v.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    : ''
  return `v${v.version}${date ? ` · ${date}` : ''}`
}

export function AdminPolicyPage() {
  const qc = useQueryClient()
  const [policyId, setPolicyId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [dsl, setDsl] = useState('{}')
  const [toast, setToast] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)
  const [validation, setValidation] = useState<{
    valid: boolean
    errors: { field?: string; message?: string }[]
    warnings: { field?: string; message?: string }[]
  } | null>(null)
  const [diff, setDiff] = useState<{
    from: number
    to: number
    added: Record<string, unknown>
    removed: Record<string, unknown>
    changed: Record<string, unknown>
  } | null>(null)
  const [editorKey, setEditorKey] = useState('')

  const listQ = useQuery({
    queryKey: ['admin', 'policies'],
    queryFn: () => listAdminPolicies({ limit: 100 }),
  })

  const policies = listQ.data?.items ?? []
  const fallback = pickPolicy(policies)
  const effectiveId = policyId ?? fallback?.id ?? null

  const policyQ = useQuery({
    queryKey: ['admin', 'policies', effectiveId],
    queryFn: () => getAdminPolicy(effectiveId!),
    enabled: Boolean(effectiveId),
  })

  const versionsQ = useQuery({
    queryKey: ['admin', 'policies', effectiveId, 'versions'],
    queryFn: () => listAdminPolicyVersions(effectiveId!),
    enabled: Boolean(effectiveId),
  })

  const policy = policyQ.data ?? policies.find((p) => p.id === effectiveId) ?? fallback
  const versions = useMemo(() => {
    const raw = versionsQ.data ?? []
    return [...raw].sort((a, b) => b.version - a.version)
  }, [versionsQ.data])

  const selectedVersion =
    versions.find((v) => v.id === versionId) ?? versions[0] ?? null
  const rules = selectedVersion?.rules ?? policy?.rules ?? EMPTY_RULES
  const ruleRows = useMemo(() => flattenRules(rules), [rules])
  const selectedRow = ruleRows.find((r) => r.id === selectedKey) ?? ruleRows[0] ?? null

  const editorSourceKey = `${effectiveId ?? ''}:${selectedVersion?.id ?? ''}:${selectedVersion?.version ?? policy?.version ?? ''}`
  if (editorSourceKey !== editorKey) {
    setEditorKey(editorSourceKey)
    setDsl(rulesJson(rules))
    setSelectedKey(Object.keys(rules)[0] ?? null)
    setValidation(null)
  }

  function invalidate() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'policies'] }),
      effectiveId
        ? qc.invalidateQueries({ queryKey: ['admin', 'policies', effectiveId] })
        : Promise.resolve(),
    ])
  }

  async function persistIfDirty(): Promise<string | null> {
    if (!effectiveId) return 'Нет политики'
    let parsed: Record<string, unknown>
    try {
      parsed = parseRules(dsl)
    } catch (err) {
      return err instanceof Error ? err.message : 'Невалидный JSON'
    }
    const current = rulesJson(rules)
    if (dsl.trim() !== current.trim()) {
      await patchAdminPolicy(effectiveId, { rules: parsed })
    }
    return null
  }

  const validateM = useMutation({
    mutationFn: async () => {
      const err = await persistIfDirty()
      if (err) throw new Error(err)
      return validateAdminPolicy(effectiveId!)
    },
    onSuccess: async (res) => {
      setValidation(res)
      await invalidate()
      setToast(res.valid ? 'Политика валидна' : 'Есть ошибки валидации')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось проверить политику')),
  })

  const publishM = useMutation({
    mutationFn: async () => {
      const err = await persistIfDirty()
      if (err) throw new Error(err)
      return publishAdminPolicy(effectiveId!, 'publish from admin ui')
    },
    onSuccess: async () => {
      await invalidate()
      setToast('Политика опубликована')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось опубликовать политику')),
  })

  const diffM = useMutation({
    mutationFn: async () => {
      if (!effectiveId) throw new Error('Нет политики')
      const to = versions[0]?.version
      const from = versions[1]?.version
      return diffAdminPolicy(effectiveId, from, to)
    },
    onSuccess: (raw) => {
      setDiff({
        from: Number(raw.fromVersion ?? raw.from_version ?? 0),
        to: Number(raw.toVersion ?? raw.to_version ?? 0),
        added: (raw.added ?? {}) as Record<string, unknown>,
        removed: (raw.removed ?? {}) as Record<string, unknown>,
        changed: (raw.changed ?? {}) as Record<string, unknown>,
      })
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось сравнить версии')),
  })

  const subtitle = policy
    ? `${policy.name} · v${policy.version} · ${policy.status}`
    : 'Нет политик'

  const diffLines = useMemo(() => {
    if (!diff) return []
    const lines: { kind: 'add' | 'del' | 'chg'; text: string }[] = []
    for (const [k, v] of Object.entries(diff.added)) {
      lines.push({ kind: 'add', text: `${k}: ${JSON.stringify(v)}` })
    }
    for (const [k, v] of Object.entries(diff.removed)) {
      lines.push({ kind: 'del', text: `${k}: ${JSON.stringify(v)}` })
    }
    for (const [k, v] of Object.entries(diff.changed)) {
      lines.push({ kind: 'chg', text: `${k}: ${JSON.stringify(v)}` })
    }
    return lines
  }, [diff])

  if (listQ.isLoading) {
    return (
      <Box>
        <PageHeader title="Кредитная политика" subtitle="Загрузка…" />
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress size={28} sx={{ color: color.primary.main }} />
        </Box>
      </Box>
    )
  }

  if (listQ.isError) {
    return (
      <Box>
        <PageHeader title="Кредитная политика" subtitle="Ошибка загрузки" />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => listQ.refetch()}>
              Повторить
            </Button>
          }
        >
          {apiError(listQ.error, 'Не удалось загрузить политики')}
        </Alert>
      </Box>
    )
  }

  if (!policy) {
    return (
      <Box>
        <PageHeader title="Кредитная политика" subtitle="Политики не созданы" />
        <Box sx={{ ...tileSx, py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: color.text.muted }}>
            Нет кредитных политик. Создайте политику через API, чтобы редактировать правила.
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Кредитная политика"
        subtitle={subtitle}
        actions={
          <>
            <Button
              variant="outlined"
              disabled={diffM.isPending || versions.length < 2}
              onClick={() => diffM.mutate()}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Сравнить версии
            </Button>
            <Button
              variant="outlined"
              disabled={validateM.isPending}
              onClick={() => validateM.mutate()}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              {validateM.isPending ? 'Проверка…' : 'Проверить'}
            </Button>
            <Button
              variant="contained"
              disabled={publishM.isPending}
              onClick={() => publishM.mutate()}
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              {publishM.isPending ? 'Публикация…' : 'Отправить на публикацию'}
            </Button>
          </>
        }
      />

      {toastError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setToastError(null)}>
          {toastError}
        </Alert>
      )}
      {toast && (
        <Alert
          severity={validation && !validation.valid ? 'warning' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setToast(null)}
        >
          {toast}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3, lg: 2.5 }}>
          <Box sx={{ ...tileSx, mb: 2 }}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: color.text.inactive,
                mb: 1,
                px: 0.5,
              }}
            >
              Политики
            </Typography>
            <List disablePadding>
              {policies.map((p) => (
                <ListItemButton
                  key={p.id}
                  selected={p.id === effectiveId}
                  onClick={() => {
                    setPolicyId(p.id)
                    setVersionId(null)
                    setDiff(null)
                  }}
                  sx={{
                    borderRadius: 2,
                    py: 0.75,
                    px: 1.25,
                    mb: 0.25,
                    '&.Mui-selected': {
                      bgcolor: color.primary.soft06,
                      color: color.text.primary,
                      '&:hover': { bgcolor: color.primary.soft08 },
                    },
                  }}
                >
                  <ListItemText
                    primary={p.name}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 650 }}
                  />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: color.text.muted }}>
                    {Object.keys(p.rules ?? {}).length}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: color.text.inactive,
                mb: 1,
                px: 0.5,
              }}
            >
              Версии
            </Typography>
            <List disablePadding>
              {versions.map((v) => {
                const isCurrent = v.version === policy.version
                const isProd = policy.status.toUpperCase() === 'PUBLISHED' && isCurrent
                return (
                  <ListItemButton
                    key={v.id}
                    selected={(selectedVersion?.id ?? '') === v.id}
                    onClick={() => setVersionId(v.id)}
                    sx={{
                      borderRadius: 2,
                      py: 0.75,
                      px: 1.25,
                      mb: 0.25,
                      '&.Mui-selected': {
                        bgcolor: color.secondary.soft03,
                      },
                    }}
                  >
                    <ListItemText
                      primary={versionLabel(v)}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    />
                    {(isCurrent || isProd) && (
                      <Chip
                        size="small"
                        label={isProd ? 'Прод' : 'Сейчас'}
                        sx={{
                          height: 22,
                          fontSize: 10.5,
                          fontWeight: 700,
                          bgcolor: isProd ? color.secondary.main : color.primary.soft08,
                          color: isProd ? color.text.onDark : color.primary.main,
                        }}
                      />
                    )}
                  </ListItemButton>
                )
              })}
              {versions.length === 0 && (
                <Typography sx={{ px: 1, py: 1, fontSize: 13, color: color.text.muted }}>
                  Версий нет
                </Typography>
              )}
            </List>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5.5, lg: 6 }}>
          <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              Параметры · {policy.code}
            </Typography>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Ключ</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Значение</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Тип</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    #
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ruleRows.map((r) => {
                  const sm = statusMeta[r.status]
                  return (
                    <TableRow
                      key={r.id}
                      hover
                      selected={r.id === selectedRow?.id}
                      onClick={() => setSelectedKey(r.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            fontFamily: font.mono,
                            color: color.text.muted,
                          }}
                        >
                          {r.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontFamily: font.mono,
                            color: color.text.primary,
                            maxWidth: 220,
                          }}
                          noWrap
                        >
                          {r.condition}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.action}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: 13, color: color.text.secondary }}>
                          {r.priority}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={sm.label}
                          sx={{
                            bgcolor: sm.bgcolor,
                            color: sm.color,
                            fontWeight: 700,
                            fontSize: 11,
                            height: 24,
                            borderRadius: `${radius.chip}px`,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {ruleRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: color.text.muted }}>
                        В политике нет правил
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>

          <Box sx={tileSx}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 15,
                  color: color.text.primary,
                }}
              >
                Редактор правил
              </Typography>
              <Chip
                size="small"
                label="JSON"
                sx={{
                  height: 22,
                  fontSize: 10.5,
                  fontWeight: 700,
                  bgcolor: color.secondary.soft06,
                  color: color.text.secondary,
                }}
              />
            </Stack>
            <TextField
              multiline
              minRows={8}
              fullWidth
              value={dsl}
              onChange={(e) => setDsl(e.target.value)}
              InputProps={{
                sx: {
                  fontFamily: font.mono,
                  fontSize: 12.5,
                  bgcolor: color.secondary.soft03,
                  borderRadius: 2,
                  '& textarea': { lineHeight: 1.55 },
                },
              }}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 3.5, lg: 3.5 }}>
          <Box sx={{ ...tileSx, mb: 2 }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              {diff ? `Изменения v${diff.from} → v${diff.to}` : 'Изменения версий'}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {[
                { label: 'Добавлено', value: diff ? Object.keys(diff.added).length : '—', c: color.semantic.success },
                { label: 'Изменено', value: diff ? Object.keys(diff.changed).length : '—', c: color.semantic.warning },
                { label: 'Удалено', value: diff ? Object.keys(diff.removed).length : '—', c: color.semantic.error },
                { label: 'Версий', value: versions.length, c: color.text.secondary },
              ].map((s) => (
                <Box
                  key={s.label}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: color.secondary.soft03,
                    border: `1px solid ${color.semantic.divider}`,
                    minWidth: 72,
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: color.text.muted, fontWeight: 600 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 750, color: s.c, lineHeight: 1.2 }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Stack
              spacing={0.5}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: '#0B1F35',
                fontFamily: font.mono,
                minHeight: 72,
              }}
            >
              {diffLines.length === 0 && (
                <Typography sx={{ fontSize: 12, fontFamily: font.mono, color: '#9AA5B1' }}>
                  Нажмите «Сравнить версии»
                </Typography>
              )}
              {diffLines.map((d) => (
                <Typography
                  key={`${d.kind}-${d.text}`}
                  sx={{
                    fontSize: 12,
                    fontFamily: font.mono,
                    color: d.kind === 'add' ? '#6EE7B7' : d.kind === 'del' ? '#FCA5A5' : '#FCD34D',
                    lineHeight: 1.45,
                  }}
                >
                  {d.kind === 'add' ? '+ ' : d.kind === 'del' ? '− ' : '~ '}
                  {d.text}
                </Typography>
              ))}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              Проверки и согласование
            </Typography>
            <Stack spacing={1.25}>
              {!validation && (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <RadioButtonUncheckedRoundedIcon
                    sx={{ fontSize: 20, color: color.text.inactive, mt: 0.1 }}
                  />
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                    Нажмите «Проверить», чтобы прогнать валидацию
                  </Typography>
                </Stack>
              )}
              {validation && (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  {validation.valid ? (
                    <CheckCircleRoundedIcon sx={{ fontSize: 20, color: color.semantic.success, mt: 0.1 }} />
                  ) : (
                    <ErrorOutlineRoundedIcon sx={{ fontSize: 20, color: color.semantic.error, mt: 0.1 }} />
                  )}
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                    {validation.valid ? 'Политика валидна' : 'Есть ошибки валидации'}
                  </Typography>
                </Stack>
              )}
              {(validation?.errors ?? []).map((e, i) => (
                <Stack key={`e-${i}`} direction="row" spacing={1} alignItems="flex-start">
                  <ErrorOutlineRoundedIcon sx={{ fontSize: 20, color: color.semantic.error, mt: 0.1 }} />
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                    {e.field ? `${e.field}: ` : ''}
                    {e.message ?? 'ошибка'}
                  </Typography>
                </Stack>
              ))}
              {(validation?.warnings ?? []).map((w, i) => (
                <Stack key={`w-${i}`} direction="row" spacing={1} alignItems="flex-start">
                  <WarningAmberRoundedIcon sx={{ fontSize: 20, color: color.semantic.warning, mt: 0.1 }} />
                  <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                    {w.field ? `${w.field}: ` : ''}
                    {w.message ?? 'предупреждение'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
