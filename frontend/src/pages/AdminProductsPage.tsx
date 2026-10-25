import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveAdminProduct,
  createAdminProduct,
  getAdminProduct,
  listAdminProducts,
  patchAdminProduct,
  publishAdminProduct,
  type AdminCreditProduct,
} from '@/api/admin'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'
import { formatMoney } from '@/utils/format'

type ProductStatus = 'active' | 'draft' | 'hidden'

type Requirement = {
  param: string
  condition: string
  hard: boolean
  ruleId: string
}

type CatalogProduct = {
  id: string
  name: string
  type: string
  apiType: string
  rateFrom: number
  rateMax: number
  amountMin: number
  amountMax: number
  termMin: number
  termMax: number
  commissionPct: number
  status: ProductStatus
  version: number
  draftVersion: number
  goals: string
  showInSelection: boolean
  allowCounteroffer: boolean
  requirements: Requirement[]
  description: string
}

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

const statusMeta: Record<ProductStatus, { label: string; bgcolor: string; color: string }> = {
  active: {
    label: 'Активен',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  draft: {
    label: 'Черновик',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  hidden: {
    label: 'Скрыт',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
}

const TYPE_LABEL: Record<string, string> = {
  working_capital: 'Оборотный',
  investment: 'Инвестиционный',
  overdraft: 'Овердрафт',
  credit_line: 'Линия',
}

const emptyDraft: CatalogProduct = {
  id: '',
  name: '',
  type: 'Оборотный',
  apiType: 'working_capital',
  rateFrom: 0,
  rateMax: 0,
  amountMin: 0,
  amountMax: 0,
  termMin: 0,
  termMax: 0,
  commissionPct: 0,
  status: 'draft',
  version: 1,
  draftVersion: 1,
  goals: '',
  showInSelection: false,
  allowCounteroffer: false,
  requirements: [],
  description: '',
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

function mapStatus(s: string): ProductStatus {
  const u = s.toUpperCase()
  if (u === 'PUBLISHED' || u === 'ACTIVE') return 'active'
  if (u === 'DRAFT') return 'draft'
  if (u === 'ARCHIVED' || u === 'HIDDEN') return 'hidden'
  return 'draft'
}

function toCatalog(p: AdminCreditProduct): CatalogProduct {
  const fee = p.fees.find((f) => f.type.toLowerCase() === 'percent')
  return {
    id: p.id,
    name: p.name,
    type: TYPE_LABEL[p.type] ?? p.type,
    apiType: p.type,
    rateFrom: p.rateMin,
    rateMax: p.rateMax,
    amountMin: p.amountMin,
    amountMax: p.amountMax,
    termMin: p.termMin,
    termMax: p.termMax,
    commissionPct: fee?.value ?? 0,
    status: mapStatus(p.status),
    version: p.version,
    draftVersion: p.version,
    goals: p.suitableGoals.join(', '),
    showInSelection: p.isActive,
    allowCounteroffer: false,
    requirements: p.documents.map((doc) => ({
      param: doc,
      condition: 'required',
      hard: true,
      ruleId: doc,
    })),
    description: p.description,
  }
}

function shortAmount(n: number): string {
  if (n >= 1_000_000) return `до ${(n / 1_000_000).toLocaleString('ru-RU')} млн`
  if (n >= 1_000) return `до ${Math.round(n / 1_000)} тыс`
  return formatMoney(n)
}

export function AdminProductsPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CatalogProduct>(emptyDraft)
  const [draftKey, setDraftKey] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')

  const listQ = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => listAdminProducts({ limit: 100 }),
  })

  const products = useMemo(
    () => (listQ.data?.items ?? []).map(toCatalog),
    [listQ.data],
  )
  const effectiveId = selectedId ?? products[0]?.id ?? null

  const detailQ = useQuery({
    queryKey: ['admin', 'products', effectiveId],
    queryFn: () => getAdminProduct(effectiveId!),
    enabled: Boolean(effectiveId),
  })

  const selected = useMemo(() => {
    if (detailQ.data && detailQ.data.id === effectiveId) return toCatalog(detailQ.data)
    return products.find((p) => p.id === effectiveId) ?? products[0] ?? null
  }, [detailQ.data, products, effectiveId])

  const nextDraftKey = selected
    ? `${selected.id}:${selected.version}:${selected.status}`
    : ''
  if (nextDraftKey !== draftKey) {
    setDraftKey(nextDraftKey)
    setDraft(selected ? { ...selected } : emptyDraft)
  }

  function invalidate() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
      effectiveId
        ? qc.invalidateQueries({ queryKey: ['admin', 'products', effectiveId] })
        : Promise.resolve(),
    ])
  }

  const saveM = useMutation({
    mutationFn: () =>
      patchAdminProduct(draft.id, {
        name: draft.name,
        rateMin: draft.rateFrom,
        rateMax: draft.rateMax || draft.rateFrom,
        amountMin: draft.amountMin || 0,
        amountMax: draft.amountMax,
        termMin: draft.termMin || 1,
        termMax: draft.termMax,
        suitableGoals: draft.goals
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        fees:
          draft.commissionPct > 0
            ? [{ name: 'Комиссия', type: 'percent', value: draft.commissionPct }]
            : [],
      }),
    onSuccess: async () => {
      await invalidate()
      setToast('Продукт сохранён')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось сохранить продукт')),
  })

  const publishM = useMutation({
    mutationFn: () => publishAdminProduct(draft.id),
    onSuccess: async () => {
      await invalidate()
      setToast('Продукт опубликован')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось опубликовать')),
  })

  const archiveM = useMutation({
    mutationFn: () => archiveAdminProduct(draft.id),
    onSuccess: async () => {
      await invalidate()
      setToast('Продукт архивирован')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось архивировать')),
  })

  const createM = useMutation({
    mutationFn: () =>
      createAdminProduct({
        name: createName.trim(),
        type: 'working_capital',
        amountMin: 100_000,
        amountMax: 1_000_000,
        termMin: 6,
        termMax: 12,
        rateMin: 15,
        rateMax: 25,
      }),
    onSuccess: async (created) => {
      setCreateOpen(false)
      setCreateName('')
      setSelectedId(created.id)
      await invalidate()
      setToast('Продукт создан')
      setToastError(null)
    },
    onError: (err) => setToastError(apiError(err, 'Не удалось создать продукт')),
  })

  function selectProduct(id: string) {
    setSelectedId(id)
  }

  function resetDraft() {
    if (selected) setDraft({ ...selected })
  }

  const activeCount = products.filter((p) => p.status === 'active').length
  const busy = saveM.isPending || publishM.isPending || archiveM.isPending

  return (
    <Box>
      <PageHeader
        title="Каталог продуктов"
        subtitle={`${listQ.data?.total ?? products.length} продуктов · ${activeCount} активных`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileUploadOutlinedIcon />}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Импорт
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Новый продукт
            </Button>
          </>
        }
      />

      {listQ.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => listQ.refetch()}>
              Повторить
            </Button>
          }
        >
          {apiError(listQ.error, 'Не удалось загрузить каталог')}
        </Alert>
      )}
      {toastError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setToastError(null)}>
          {toastError}
        </Alert>
      )}
      {toast && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setToast(null)}>
          {toast}
        </Alert>
      )}

      {listQ.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress size={28} sx={{ color: color.primary.main }} />
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Продукт</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Тип</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Ставка</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Сумма</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Срок</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Статус</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Вер.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => {
                    const sm = statusMeta[p.status]
                    return (
                      <TableRow
                        key={p.id}
                        hover
                        selected={p.id === effectiveId}
                        onClick={() => selectProduct(p.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.text.muted }}>
                            {p.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>{p.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13, color: color.text.secondary }}>{p.type}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13 }}>
                            от {p.rateFrom.toLocaleString('ru-RU')}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13 }}>{shortAmount(p.amountMax)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13 }}>{p.termMax} мес</Typography>
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
                          <Typography sx={{ fontSize: 12.5, color: color.text.muted }}>
                            v{p.version}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography sx={{ py: 3, textAlign: 'center', color: color.text.muted }}>
                          Каталог пуст
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>

            <Box sx={{ ...tileSx, overflow: 'auto' }}>
              <Typography
                sx={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 15,
                  mb: 1.25,
                  color: color.text.primary,
                }}
              >
                Требования к заёмщику · {selected?.name ?? '—'}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Параметр</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Условие</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: color.text.secondary }}>
                      Жёсткое
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Правило</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selected?.requirements ?? []).map((r) => (
                    <TableRow key={r.ruleId}>
                      <TableCell>
                        <Typography sx={{ fontSize: 13.5 }}>{r.param}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{r.condition}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        {r.hard ? (
                          <CheckRoundedIcon sx={{ fontSize: 18, color: color.semantic.success }} />
                        ) : (
                          <CloseRoundedIcon sx={{ fontSize: 18, color: color.text.inactive }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: color.text.muted,
                            fontFamily: font.mono,
                          }}
                        >
                          {r.ruleId}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!selected || selected.requirements.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography sx={{ py: 2, textAlign: 'center', color: color.text.muted }}>
                          Документы не заданы
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={tileSx}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography
                  sx={{
                    fontFamily: font.display,
                    fontWeight: 700,
                    fontSize: 15,
                    color: color.text.primary,
                  }}
                >
                  Редактирование: {draft.id || '—'}
                </Typography>
                <Chip
                  size="small"
                  label={`Черновик v${draft.draftVersion}`}
                  sx={{
                    bgcolor: 'rgba(217,119,6,0.12)',
                    color: color.semantic.warning,
                    fontWeight: 700,
                    fontSize: 11,
                    height: 24,
                  }}
                />
              </Stack>

              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <TextField
                  size="small"
                  label="Название"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  fullWidth
                  disabled={!draft.id}
                />
                <TextField
                  size="small"
                  label="Ставка от, %"
                  type="number"
                  value={draft.rateFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, rateFrom: Number(e.target.value) }))}
                  fullWidth
                  disabled={!draft.id}
                />
                <TextField
                  size="small"
                  label="Сумма до, ₽"
                  type="number"
                  value={draft.amountMax}
                  onChange={(e) => setDraft((d) => ({ ...d, amountMax: Number(e.target.value) }))}
                  fullWidth
                  disabled={!draft.id}
                />
                <TextField
                  size="small"
                  label="Срок до, мес"
                  type="number"
                  value={draft.termMax}
                  onChange={(e) => setDraft((d) => ({ ...d, termMax: Number(e.target.value) }))}
                  fullWidth
                  disabled={!draft.id}
                />
                <TextField
                  size="small"
                  label="Комиссия, %"
                  type="number"
                  value={draft.commissionPct}
                  onChange={(e) => setDraft((d) => ({ ...d, commissionPct: Number(e.target.value) }))}
                  fullWidth
                  disabled={!draft.id}
                />
                <TextField
                  size="small"
                  label="Цели"
                  value={draft.goals}
                  onChange={(e) => setDraft((d) => ({ ...d, goals: e.target.value }))}
                  fullWidth
                  disabled={!draft.id}
                  helperText="через запятую"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.showInSelection}
                      onChange={(_, v) => setDraft((d) => ({ ...d, showInSelection: v }))}
                      color="success"
                      disabled={!draft.id}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Показывать в подборе</Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.allowCounteroffer}
                      onChange={(_, v) => setDraft((d) => ({ ...d, allowCounteroffer: v }))}
                      color="success"
                      disabled={!draft.id}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Разрешить counteroffer</Typography>
                  }
                />

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => saveM.mutate()}
                  disabled={!draft.id || busy}
                  sx={{ borderRadius: `${radius.button}px`, fontWeight: 700, py: 1.1 }}
                >
                  {saveM.isPending ? 'Сохранение…' : 'Сохранить'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => publishM.mutate()}
                  disabled={!draft.id || busy || draft.status === 'active'}
                  sx={{
                    borderRadius: `${radius.button}px`,
                    fontWeight: 600,
                    borderColor: color.secondary.soft08,
                    color: color.text.primary,
                  }}
                >
                  {publishM.isPending ? 'Публикация…' : 'Опубликовать'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={() => archiveM.mutate()}
                  disabled={!draft.id || busy || draft.status === 'hidden'}
                  sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
                >
                  {archiveM.isPending ? 'Архивация…' : 'Архивировать'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={resetDraft}
                  disabled={!draft.id || busy}
                  sx={{
                    borderRadius: `${radius.button}px`,
                    fontWeight: 600,
                    borderColor: color.secondary.soft08,
                    color: color.text.primary,
                  }}
                >
                  Отменить
                </Button>
                <Typography sx={{ fontSize: 12, color: color.text.muted, textAlign: 'center' }}>
                  Изменение уйдёт на согласование
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Новый продукт</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            size="small"
            label="Название"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            helperText="Тип: оборотный · 100 тыс–1 млн · 6–12 мес · 15–25%"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={createM.isPending || !createName.trim()}
            onClick={() => createM.mutate()}
          >
            {createM.isPending ? 'Создание…' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
