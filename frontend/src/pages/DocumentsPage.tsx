import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import {
  deleteCompanyDocument,
  downloadCompanyDocument,
  listCompanyDocuments,
  uploadCompanyDocument,
  type CompanyDocument,
  type VaultDocStatus,
} from '@/api/documents'
import {
  demoAppDocumentUrl,
  fetchApplicationAgreementPdfBlob,
  previewApplicationDocumentUrl,
} from '@/api/applications'
import {
  listDocumentReviews,
  patchDocumentReview,
  REVIEW_STATUS_LABEL,
  type DocumentReview,
} from '@/api/docReviews'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'

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

type DocStatus = VaultDocStatus
type DocCategory = 'Учредительные' | 'Финансовые' | 'Имущество' | 'Владельцы' | 'Согласия'
type DocItem = CompanyDocument

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

type TabKey = 'all' | 'need_upload' | 'pending' | 'accepted' | 'mine_review'

const STATUS_META: Record<
  DocStatus,
  { label: string; bg: string; color: string }
> = {
  accepted: { label: 'Принят', bg: '#E6F5EE', color: '#1B8A5A' },
  accepted_remark: { label: 'Принят с замечанием', bg: '#FFF0E0', color: '#C45A12' },
  pending: { label: 'На проверке', bg: '#FFE8D6', color: '#C45A12' },
  need_upload: { label: 'Нужно загрузить', bg: '#FDE8E6', color: '#C41E14' },
}

function StatusChip({ status }: { status: DocStatus }) {
  const m = STATUS_META[status]
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
        bgcolor: m.bg,
        color: m.color,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </Box>
  )
}

function matchesTab(doc: DocItem, tab: TabKey) {
  if (tab === 'all') return true
  if (tab === 'need_upload') return doc.status === 'need_upload'
  if (tab === 'pending') return doc.status === 'pending'
  return doc.status === 'accepted' || doc.status === 'accepted_remark'
}

export function DocumentsPage() {
  const { user } = useAuth()
  const { companyId: storeCompanyId, company } = useAppStore()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const companyId = storeCompanyId || user?.companyId
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [tab, setTab] = useState<TabKey>(() =>
    params.get('tab') === 'review' ? 'mine_review' : 'all',
  )
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | DocCategory>('all')
  const [period, setPeriod] = useState('12')
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    title: string
    url: string
    blob: boolean
  } | null>(null)
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [workspaceUrl, setWorkspaceUrl] = useState<string | null>(null)
  const [workspaceBlob, setWorkspaceBlob] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)

  useEffect(() => {
    if (params.get('tab') === 'review') setTab('mine_review')
  }, [params])

  useEffect(() => {
    return () => {
      if (preview?.blob && preview.url) URL.revokeObjectURL(preview.url)
      if (workspaceBlob && workspaceUrl) URL.revokeObjectURL(workspaceUrl)
    }
  }, [preview, workspaceBlob, workspaceUrl])

  const docsQ = useQuery({
    queryKey: ['company-documents', companyId, category !== 'all' ? category : undefined],
    queryFn: () =>
      listCompanyDocuments(companyId!, {
        category: category !== 'all' ? category : undefined,
      }),
    enabled: Boolean(companyId),
  })
  const docs = docsQ.data ?? []

  const myReviewsQ = useQuery({
    queryKey: ['document-reviews', companyId, 'mine'],
    queryFn: () => listDocumentReviews(companyId!, { mine: true }),
    enabled: Boolean(companyId),
  })
  const myReviews = myReviewsQ.data ?? []
  const pendingMine = myReviews.filter((r) => r.status === 'pending' || r.status === 'viewed')

  const stats = useMemo(() => {
    const accepted = docs.filter(
      (d) => d.status === 'accepted' || d.status === 'accepted_remark',
    ).length
    const pending = docs.filter((d) => d.status === 'pending').length
    const need = docs.filter((d) => d.status === 'need_upload').length
    return { total: docs.length, accepted, pending, need }
  }, [docs])

  const filtered = useMemo(() => {
    if (tab === 'mine_review') return []
    const q = search.trim().toLowerCase()
    return docs.filter((d) => {
      if (!matchesTab(d, tab)) return false
      if (category !== 'all' && d.category !== category) return false
      if (q && !d.title.toLowerCase().includes(q) && !(d.file ?? '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [docs, tab, search, category])

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase()
    return myReviews.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q) && !(r.fileName || '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [myReviews, search])

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function openUpload(docId?: string) {
    setUploadTarget(docId ?? null)
    fileRef.current?.click()
  }

  const uploadM = useMutation({
    mutationFn: async ({ file, targetId }: { file: File; targetId: string | null }) => {
      if (!companyId) throw new Error('Нет компании')
      const existing = targetId ? docs.find((d) => d.id === targetId) : undefined
      return uploadCompanyDocument(companyId, {
        file,
        title: existing?.title || file.name.replace(/\.[^.]+$/, '') || 'Новый документ',
        category: existing?.category || (category !== 'all' ? category : 'Финансовые'),
      })
    },
    onSuccess: async (_doc, vars) => {
      await qc.invalidateQueries({ queryKey: ['company-documents'] })
      setActionError(null)
      flashMsg(vars.targetId ? 'Документ отправлен на проверку' : 'Документ загружен')
    },
    onError: (err) => setActionError(apiError(err, 'Не удалось загрузить документ')),
  })

  const deleteM = useMutation({
    mutationFn: async (docId: string) => {
      if (!companyId) throw new Error('Нет компании')
      await deleteCompanyDocument(companyId, docId)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-documents'] })
      setActionError(null)
      flashMsg('Документ удалён')
    },
    onError: (err) => setActionError(apiError(err, 'Не удалось удалить документ')),
  })

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadM.mutate({ file, targetId: uploadTarget })
    setUploadTarget(null)
  }

  async function openDoc(d: DocItem) {
    if (!companyId) return
    try {
      await downloadCompanyDocument(companyId, d.id, d.fileName || undefined)
    } catch (err) {
      setActionError(apiError(err, 'Не удалось скачать документ'))
    }
  }

  async function resolveReviewPdf(r: DocumentReview): Promise<{ url: string; blob: boolean }> {
    if (!companyId) throw new Error('Нет компании')
    if (r.kind === 'agreement' && r.applicationId) {
      const blob = await fetchApplicationAgreementPdfBlob(companyId, r.applicationId)
      return { url: URL.createObjectURL(blob), blob: true }
    }
    if (r.documentId && r.applicationId) {
      try {
        const url = await previewApplicationDocumentUrl(companyId, r.applicationId, r.documentId)
        return { url, blob: true }
      } catch {
        /* fall through to demo */
      }
    }
    if (r.fileName) {
      const demo = demoAppDocumentUrl(r.fileName)
      const ok = await fetch(demo)
        .then((res) => res.ok)
        .catch(() => false)
      if (ok) return { url: demo, blob: false }
    }
    if (r.kind === 'decision_report' || r.kind === 'agreement') {
      return { url: '/demo/credit_contract_demo.pdf', blob: false }
    }
    throw new Error('Нет файла для предпросмотра')
  }

  async function openReviewWorkspace(r: DocumentReview) {
    if (!companyId) return
    setActiveReviewId(r.id)
    setReviewComment(r.comment || '')
    setWorkspaceLoading(true)
    setActionError(null)
    try {
      if (workspaceBlob && workspaceUrl) URL.revokeObjectURL(workspaceUrl)
      const { url, blob } = await resolveReviewPdf(r)
      setWorkspaceUrl(url)
      setWorkspaceBlob(blob)
      if (r.status === 'pending') {
        void patchDocumentReview(companyId, r.id, { status: 'viewed' }).then(() =>
          qc.invalidateQueries({ queryKey: ['document-reviews'] }),
        )
      }
    } catch (err) {
      setWorkspaceUrl(null)
      setWorkspaceBlob(false)
      setActionError(apiError(err, 'Не удалось открыть документ'))
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function decideReview(r: DocumentReview, status: 'approved' | 'rejected') {
    if (!companyId) return
    const comment = reviewComment.trim()
    if (status === 'rejected' && !comment) {
      setActionError('Для отправки на доработку напишите комментарий')
      return
    }
    try {
      await patchDocumentReview(companyId, r.id, {
        status,
        comment: comment || undefined,
      })
      flashMsg(
        status === 'approved'
          ? 'Корректность подтверждена · владелец получит уведомление'
          : 'Отправлено на доработку · владелец увидит комментарий',
      )
      setReviewComment('')
      await qc.invalidateQueries({ queryKey: ['document-reviews'] })
      await qc.invalidateQueries({ queryKey: ['doc-reviews'] })
      await qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      await qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err) {
      setActionError(apiError(err, 'Не удалось обновить статус'))
    }
  }

  const activeReview = useMemo(
    () => filteredReviews.find((r) => r.id === activeReviewId) ?? null,
    [filteredReviews, activeReviewId],
  )

  useEffect(() => {
    if (tab !== 'mine_review') return
    if (activeReviewId && filteredReviews.some((r) => r.id === activeReviewId)) return
    const first = filteredReviews.find((r) => r.status === 'pending' || r.status === 'viewed')
      ?? filteredReviews[0]
    if (first) void openReviewWorkspace(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filteredReviews.length, companyId])

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'all', label: 'Все' },
    { key: 'need_upload', label: 'Нужно загрузить', badge: stats.need },
    { key: 'pending', label: 'На проверке' },
    { key: 'accepted', label: 'Приняты' },
    {
      key: 'mine_review',
      label: 'Мне на проверку',
      badge: pendingMine.length || undefined,
    },
  ]

  const thSx = {
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 700,
    color: '#9AA5B1',
    pb: 1.25,
    pr: 1.5,
    borderBottom: '1px solid rgba(11,31,53,0.08)',
  }

  const statCards = [
    {
      label: 'Всего документов',
      value: stats.total,
      caption: company?.name || 'в хранилище',
      captionColor: '#9AA5B1',
    },
    {
      label: 'Приняты',
      value: stats.accepted,
      caption: 'проверены менеджером',
      captionColor: '#1B8A5A',
    },
    {
      label: 'На проверке',
      value: stats.pending,
      caption: 'ожидает решения',
      captionColor: '#C45A12',
    },
    {
      label: 'Нужно загрузить',
      value: stats.need,
      caption: 'срок до 25.10.2026',
      captionColor: '#C41E14',
    },
  ]

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
        hidden
        onChange={onFilePicked}
      />

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
            Документы
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            {company?.name ? `${company.name} · хранилище документов` : 'Хранилище документов компании'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => flashMsg('ZIP формируется…')}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Скачать всё (ZIP)
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFileRoundedIcon />}
            disabled={!companyId || uploadM.isPending}
            onClick={() => openUpload()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Загрузить документ
          </Button>
        </Stack>
      </Stack>

      {actionError && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#FDE8E6',
            color: '#C41E14',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {actionError}
        </Box>
      )}
      {flash && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {flash}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 2.5,
        }}
      >
        {statCards.map((c) => (
          <Box key={c.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 0.75 }}>
              {c.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: '-0.03em',
                color: '#0B1F35',
                lineHeight: 1,
                mb: 0.75,
              }}
            >
              {c.value}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: c.captionColor }}>
              {c.caption}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack
        direction="row"
        spacing={0}
        sx={{
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          mb: 2,
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              onClick={() => setTab(t.key)}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                px: 1.75,
                py: 1.15,
                fontSize: 14,
                fontWeight: 700,
                color: active ? '#0B1F35' : '#7A8795',
                borderBottom: active ? '2px solid #EF3124' : '2px solid transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                whiteSpace: 'nowrap',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <Box
                  component="span"
                  sx={{
                    minWidth: 20,
                    height: 20,
                    px: 0.6,
                    borderRadius: 999,
                    bgcolor: '#E8ECF0',
                    color: '#5A6B7D',
                    fontSize: 11.5,
                    fontWeight: 800,
                    display: 'inline-grid',
                    placeItems: 'center',
                  }}
                >
                  {t.badge}
                </Box>
              )}
            </Box>
          )
        })}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'minmax(0, 1.5fr) minmax(140px, 0.7fr) minmax(120px, 0.55fr)',
          },
          mb: 2,
        }}
      >
        <TextField
          placeholder="Поиск по названию"
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
          label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          sx={fieldSx}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="Учредительные">Учредительные</MenuItem>
          <MenuItem value="Финансовые">Финансовые</MenuItem>
          <MenuItem value="Имущество">Имущество</MenuItem>
          <MenuItem value="Владельцы">Владельцы</MenuItem>
          <MenuItem value="Согласия">Согласия</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Период"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={fieldSx}
        >
          <MenuItem value="3">3 мес</MenuItem>
          <MenuItem value="6">6 мес</MenuItem>
          <MenuItem value="12">12 мес</MenuItem>
          <MenuItem value="24">24 мес</MenuItem>
        </TextField>
      </Box>

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto', p: { xs: 1.5, md: 2 } }}>
        {tab === 'mine_review' ? (
          <Box>
            <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', mb: 1.5, px: 0.5 }}>
              Предпросмотр PDF, комментарий и решение — владелец заявки увидит результат в
              уведомлениях и сможет заменить файл или сам согласовать.
            </Typography>
            {myReviewsQ.isLoading && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <CircularProgress size={24} sx={{ color: '#EF3124' }} />
              </Box>
            )}
            {!myReviewsQ.isLoading && filteredReviews.length === 0 && (
              <Typography sx={{ py: 3, color: '#9AA5B1', fontSize: 14, textAlign: 'center' }}>
                Пока нет назначений на проверку
              </Typography>
            )}
            {filteredReviews.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
                  gap: 1.5,
                  minHeight: { md: 560 },
                }}
              >
                <Stack spacing={1} sx={{ maxHeight: { md: 640 }, overflow: 'auto' }}>
                  {filteredReviews.map((r) => {
                    const active = r.id === activeReviewId
                    return (
                      <Box
                        key={r.id}
                        onClick={() => void openReviewWorkspace(r)}
                        sx={{
                          p: 1.35,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: active
                            ? '1.5px solid rgba(239,49,36,0.45)'
                            : '1px solid rgba(11,31,53,0.08)',
                          bgcolor: active ? 'rgba(239,49,36,0.04)' : '#F7F8FA',
                          '&:hover': { borderColor: 'rgba(11,31,53,0.18)' },
                        }}
                      >
                        <Typography sx={{ fontWeight: 750, fontSize: 13.5, color: '#0B1F35' }}>
                          {r.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#8A96A3', mt: 0.35 }}>
                          {REVIEW_STATUS_LABEL[r.status] || r.status}
                          {r.assignedByName ? ` · от ${r.assignedByName}` : ''}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>

                <Box
                  sx={{
                    borderRadius: 2.5,
                    border: '1px solid rgba(11,31,53,0.08)',
                    bgcolor: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 480,
                    overflow: 'hidden',
                  }}
                >
                  {activeReview ? (
                    <>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderBottom: '1px solid rgba(11,31,53,0.08)',
                        }}
                      >
                        <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0B1F35' }}>
                          {activeReview.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#8A96A3', mt: 0.35 }}>
                          {activeReview.fileName || activeReview.kind}
                          {activeReview.assignedByName
                            ? ` · назначил ${activeReview.assignedByName}`
                            : ''}
                        </Typography>
                        {activeReview.kind === 'agreement' && activeReview.applicationId && (
                          <Button
                            component={RouterLink}
                            to={`/app/applications/${activeReview.applicationId}/contract`}
                            size="small"
                            sx={{ mt: 1, textTransform: 'none', fontWeight: 700, px: 0 }}
                          >
                            Открыть кредитный договор
                          </Button>
                        )}
                      </Box>

                      <Box sx={{ flex: 1, bgcolor: '#EEF1F4', minHeight: 280, position: 'relative' }}>
                        {workspaceLoading && (
                          <Box sx={{ display: 'grid', placeItems: 'center', height: 280 }}>
                            <CircularProgress size={28} sx={{ color: '#EF3124' }} />
                          </Box>
                        )}
                        {!workspaceLoading && workspaceUrl && (
                          <Box
                            component="iframe"
                            title={activeReview.title}
                            src={`${workspaceUrl}#toolbar=0`}
                            sx={{ width: '100%', height: '100%', minHeight: 320, border: 0, bgcolor: '#fff' }}
                          />
                        )}
                        {!workspaceLoading && !workspaceUrl && (
                          <Typography sx={{ p: 3, color: '#9AA5B1', fontSize: 14 }}>
                            Не удалось загрузить предпросмотр
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ p: 2, borderTop: '1px solid rgba(11,31,53,0.08)' }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          label="Комментарий"
                          placeholder="Подтвердите корректность или опишите, что поправить"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          disabled={
                            activeReview.status === 'approved' || activeReview.status === 'rejected'
                          }
                          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        {(activeReview.status === 'pending' || activeReview.status === 'viewed') && (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              variant="contained"
                              onClick={() => void decideReview(activeReview, 'approved')}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                boxShadow: 'none',
                                bgcolor: '#1B8A5A',
                                '&:hover': { bgcolor: '#167A4E', boxShadow: 'none' },
                              }}
                            >
                              Подтвердить корректность
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => void decideReview(activeReview, 'rejected')}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              На доработку
                            </Button>
                            <Button
                              size="small"
                              startIcon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
                              onClick={() => {
                                if (!workspaceUrl) return
                                setPreview({
                                  title: activeReview.title,
                                  url: workspaceUrl,
                                  blob: false,
                                })
                              }}
                              sx={{ textTransform: 'none', fontWeight: 700, ml: { sm: 'auto' } }}
                            >
                              На весь экран
                            </Button>
                          </Stack>
                        )}
                        {(activeReview.status === 'approved' ||
                          activeReview.status === 'rejected') && (
                          <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>
                            Решение уже отправлено владельцу
                            {activeReview.comment ? `: «${activeReview.comment}»` : '.'}
                          </Typography>
                        )}
                      </Box>
                    </>
                  ) : (
                    <Typography sx={{ p: 3, color: '#9AA5B1' }}>Выберите документ слева</Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <Box component="thead">
            <Box component="tr">
              {['Документ', 'Категория', 'Файл', 'Загружен', 'Статус', ''].map((h, i) => (
                <Box
                  component="th"
                  key={h || 'action'}
                  sx={{
                    ...thSx,
                    pr: i === 5 ? 0 : 1.5,
                    width: i === 5 ? 90 : undefined,
                  }}
                >
                  {h}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {docsQ.isLoading && (
              <Box component="tr">
                <Box component="td" colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                  <CircularProgress size={24} sx={{ color: '#EF3124' }} />
                </Box>
              </Box>
            )}
            {!docsQ.isLoading && filtered.map((d) => (
              <Box
                component="tr"
                key={d.id}
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
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                    {d.title}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{d.category}</Typography>
                </Box>
                <Box component="td">
                  <Typography
                    sx={{
                      fontSize: d.file ? 12.5 : 13,
                      color: d.file ? '#5A6B7D' : '#C5CCD3',
                      fontFamily: d.file
                        ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                        : 'inherit',
                    }}
                  >
                    {d.file ?? '—'}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: d.uploadedAt ? '#5A6B7D' : '#C5CCD3' }}>
                    {d.uploadedAt ?? '—'}
                  </Typography>
                </Box>
                <Box component="td">
                  <StatusChip status={d.status} />
                </Box>
                <Box component="td" sx={{ pr: '0 !important', textAlign: 'right' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {d.status === 'need_upload' ? (
                      <Button
                        type="button"
                        size="small"
                        disabled={uploadM.isPending || !companyId}
                        onClick={() => openUpload(d.id)}
                        sx={{
                          fontWeight: 700,
                          textTransform: 'none',
                          color: '#EF3124',
                          minWidth: 0,
                          px: 0.5,
                        }}
                      >
                        Загрузить
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="small"
                        disabled={!companyId}
                        onClick={() => void openDoc(d)}
                        sx={{
                          fontWeight: 700,
                          textTransform: 'none',
                          color: '#EF3124',
                          minWidth: 0,
                          px: 0.5,
                        }}
                      >
                        Открыть
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="small"
                      disabled={deleteM.isPending || !companyId}
                      onClick={() => deleteM.mutate(d.id)}
                      sx={{
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#C41E14',
                        minWidth: 0,
                        px: 0.5,
                      }}
                    >
                      Удалить
                    </Button>
                  </Stack>
                </Box>
              </Box>
            ))}
            {!docsQ.isLoading && filtered.length === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                    Документы не найдены
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          alignItems: 'flex-start',
          px: 1.75,
          py: 1.4,
          borderRadius: 2.5,
          bgcolor: '#FFF6EB',
          border: '1px solid rgba(196,90,18,0.18)',
        }}
      >
        <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: '#7A5A3A', lineHeight: 1.45 }}>
          Принимаем PDF, JPG, PNG, XLSX до 20 МБ. Документы шифруются и доступны только менеджеру и
          аналитику по вашей заявке. Назначения на проверку видит исполнитель во вкладке «Мне на
          проверку» и в задачах команды.
        </Typography>
      </Box>

      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          if (preview?.blob && preview.url) URL.revokeObjectURL(preview.url)
          setPreview(null)
        }}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { borderRadius: 3, height: { xs: '90vh', md: '85vh' } } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: '1px solid rgba(11,31,53,0.08)',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{preview?.title}</Typography>
          <IconButton
            onClick={() => {
              if (preview?.blob && preview.url) URL.revokeObjectURL(preview.url)
              setPreview(null)
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#EEF1F4' }}>
          {preview?.url && (
            <Box
              component="iframe"
              title={preview.title}
              src={`${preview.url}#toolbar=1`}
              sx={{ width: '100%', height: '100%', minHeight: '70vh', border: 0, bgcolor: '#fff' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
