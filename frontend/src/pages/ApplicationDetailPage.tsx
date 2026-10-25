import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/common/EmptyState'
import {
  acceptApplicationOffer,
  declineApplicationOffer,
  fetchApplicationComments,
  fetchApplicationDecision,
  fetchApplicationOffers,
  fetchDocumentRequests,
  getApplication,
  isLiveOffer,
  postApplicationComment,
  uploadApplicationDocument,
  uploadCompanyApplicationDocument,
  type CreditOffer,
  type DocumentRequest,
  type PublicDecision,
} from '@/api/applications'
import {
  fetchApplicationExplanation,
  formatAiError,
  type AiAgentResponse,
} from '@/api/ai'
import { AiAgentReply } from '@/components/ai/AiAgentReply'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import {
  formatBytesLabel,
  loadAppDocuments,
  saveAppDocuments,
  type AppDocSlot,
  type AppDocStatus,
} from '@/features/applications/appDocuments'
import { loadLocalApps, upsertLocalApp } from '@/features/applications/localApps'
import { formatDateTime, formatMoney } from '@/utils/format'
import { statusLabels } from '@/data/labels'
import { isEditableApplication } from '@/pages/ApplicationEditPage'
import type { ApplicationStatus } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,text/xml,application/xml'

const DOC_STATUS_UI: Record<
  AppDocStatus,
  { label: string; bg: string; color: string; iconBg: string; iconColor: string }
> = {
  uploaded: {
    label: 'Загружен',
    bg: '#E6F5EE',
    color: '#1B8A5A',
    iconBg: '#E6F5EE',
    iconColor: '#1B8A5A',
  },
  needed: {
    label: 'Нужен',
    bg: '#FDE8E6',
    color: '#C41E14',
    iconBg: '#FDE8E6',
    iconColor: '#EF3124',
  },
  review: {
    label: 'На проверке',
    bg: '#FFF0E0',
    color: '#C45A12',
    iconBg: '#FFF0E0',
    iconColor: '#C45A12',
  },
  optional: {
    label: 'Опционально',
    bg: '#EEF1F4',
    color: '#5A6B7D',
    iconBg: '#EEF1F4',
    iconColor: '#8A96A3',
  },
}

const APP_STATUS_CHIP: Record<ApplicationStatus, { bg: string; color: string }> = {
  draft: { bg: '#EEF1F4', color: '#5A6B7D' },
  submitted: { bg: '#E8F1FB', color: '#1A4A7A' },
  validating: { bg: '#E8F1FB', color: '#1A4A7A' },
  in_review: { bg: '#FFF0E0', color: '#C45A12' },
  docs_requested: { bg: '#FDE8E6', color: '#C41E14' },
  approved: { bg: '#E6F5EE', color: '#1B8A5A' },
  counteroffered: { bg: '#FFF0E0', color: '#C45A12' },
  offer_accepted: { bg: '#E6F5EE', color: '#1B8A5A' },
  agreement_preparation: { bg: '#E6F5EE', color: '#1B8A5A' },
  rejected: { bg: '#FDE8E6', color: '#C41E14' },
  issued: { bg: '#E6F5EE', color: '#1B8A5A' },
}

function pipelineStep(status: ApplicationStatus): number {
  switch (status) {
    case 'draft':
    case 'submitted':
    case 'validating':
      return 0
    case 'docs_requested':
      return 1
    case 'in_review':
      return 2
    case 'approved':
    case 'counteroffered':
      return 3
    case 'offer_accepted':
    case 'agreement_preparation':
    case 'rejected':
    case 'issued':
      return 4
    default:
      return 0
  }
}

function appCode(id: string): string {
  return id.toUpperCase().startsWith('ABC') ? id : `ABC-${id.slice(-8).toUpperCase()}`
}

function estimateMonthly(amount: number, termMonths: number, annualRate: number): number {
  if (!amount || !termMonths) return 0
  const r = annualRate / 100 / 12
  if (r <= 0) return amount / termMonths
  return (amount * r) / (1 - Math.pow(1 + r, -termMonths))
}

function shortMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} млн ₽`
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс ₽`
  return formatMoney(n)
}

export function ApplicationDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { companyId: storeCompanyId } = useAppStore()
  const editable = Boolean(id && isEditableApplication(id))
  const companyIdHint = storeCompanyId || user?.companyId

  const appQ = useQuery({
    queryKey: ['application', id, companyIdHint],
    queryFn: () => getApplication(id!, companyIdHint),
    enabled: Boolean(id) && !editable,
    retry: false,
  })

  const localApp = useMemo(
    () => (id ? loadLocalApps().find((a) => a.id === id) : undefined),
    [id, appQ.dataUpdatedAt],
  )
  const app = appQ.data ?? localApp
  const companyId = app?.companyId || companyIdHint

  const [explanation, setExplanation] = useState<AiAgentResponse | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)

  const decisionQ = useQuery({
    queryKey: ['application', id, 'decision'],
    queryFn: () => fetchApplicationDecision(companyId!, id!),
    enabled: Boolean(id && companyId && !editable),
    retry: false,
  })
  const offersQ = useQuery({
    queryKey: ['application', id, 'offers'],
    queryFn: () => fetchApplicationOffers(companyId!, id!),
    enabled: Boolean(id && companyId && !editable),
    retry: false,
  })
  const docReqsQ = useQuery({
    queryKey: ['application', id, 'document-requests'],
    queryFn: () => fetchDocumentRequests(companyId!, id!),
    enabled: Boolean(id && companyId && !editable),
    retry: false,
  })
  const commentsQ = useQuery({
    queryKey: ['application', id, 'comments'],
    queryFn: () => fetchApplicationComments(companyId!, id!),
    enabled: Boolean(id && companyId && !editable),
    retry: false,
    refetchInterval: 15_000,
  })

  const [slots, setSlots] = useState<AppDocSlot[]>(() => (id ? loadAppDocuments(id) : []))
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const bulkRef = useRef<HTMLInputElement>(null)
  const docReqFileRef = useRef<HTMLInputElement>(null)
  const [activeDocReq, setActiveDocReq] = useState<DocumentRequest | null>(null)

  useEffect(() => {
    if (id) setSlots(loadAppDocuments(id))
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined' || !app) return
    if (window.location.hash !== '#documents') return
    window.requestAnimationFrame(() => {
      document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [app])

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  // hooks must stay above early returns (React #310)
  const acceptM = useMutation({
    mutationFn: (offer: CreditOffer) =>
      acceptApplicationOffer(companyId!, id!, offer.id, offer.offerVersion),
    onSuccess: async () => {
      showFlash('Предложение банка принято')
      await qc.invalidateQueries({ queryKey: ['application', id] })
      await qc.invalidateQueries({ queryKey: ['application', id, 'offers'] })
      await qc.invalidateQueries({ queryKey: ['application', id, 'decision'] })
      await qc.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Не удалось принять предложение',
      )
    },
  })

  const declineM = useMutation({
    mutationFn: (offer: CreditOffer) =>
      declineApplicationOffer(companyId!, id!, offer.id, 'Отклонено клиентом'),
    onSuccess: async () => {
      showFlash('Предложение отклонено')
      await qc.invalidateQueries({ queryKey: ['application', id, 'offers'] })
      await qc.invalidateQueries({ queryKey: ['application', id] })
    },
    onError: () => setError('Не удалось отклонить предложение'),
  })

  const chatM = useMutation({
    mutationFn: () => postApplicationComment(companyId!, id!, chatText.trim()),
    onSuccess: async () => {
      setChatText('')
      showFlash('Сообщение отправлено банку')
      await qc.invalidateQueries({ queryKey: ['application', id, 'comments'] })
      await qc.invalidateQueries({ queryKey: ['application', id] })
    },
    onError: () => setError('Не удалось отправить сообщение'),
  })

  const required = slots.filter((s) => s.required)
  const doneRequired = required.filter(
    (s) => s.status === 'uploaded' || s.status === 'review',
  ).length
  const waiting = required.filter((s) => s.status === 'needed').length
  const progress = required.length ? Math.round((doneRequired / required.length) * 100) : 0
  const missingTitles = required
    .filter((s) => s.status === 'needed')
    .map((s) => s.title.toLowerCase())
  const docsReady = waiting === 0
  const readiness = Math.min(
    100,
    Math.max(app?.readinessScore ?? 0, 55 + doneRequired * 9),
  )

  if (editable && id) {
    return <Navigate to={`/app/applications/${id}/edit`} replace />
  }

  if (appQ.isLoading && !localApp) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <CircularProgress sx={{ color: '#EF3124' }} />
      </Box>
    )
  }

  if (!app || !id) {
    return (
      <EmptyState
        title="Заявка не найдена"
        description="Проверьте список заявок."
        actionLabel="К заявкам"
        actionTo="/app/applications"
      />
    )
  }

  function persist(next: AppDocSlot[]) {
    setSlots(next)
    if (id) saveAppDocuments(id, next)
  }

  async function attachFile(slotId: string, file: File) {
    if (!id || !app) return
    setBusyId(slotId)
    setError(null)
    try {
      try {
        if (app.companyId) {
          await uploadCompanyApplicationDocument(app.companyId, app.id, file, {
            docType: slots.find((s) => s.id === slotId)?.id || 'OTHER',
          })
        } else {
          const updated = await uploadApplicationDocument(app.id, file)
          upsertLocalApp(updated)
        }
        await qc.invalidateQueries({ queryKey: ['application', id] })
        await qc.invalidateQueries({ queryKey: ['applications'] })
      } catch {
        /* local checklist still updates */
      }
      persist(
        slots.map((s) =>
          s.id === slotId
            ? {
                ...s,
                status: 'uploaded' as AppDocStatus,
                fileName: file.name,
                fileSizeLabel: formatBytesLabel(file.size),
              }
            : s,
        ),
      )
      showFlash(`Загружено: ${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить файл')
    } finally {
      setBusyId(null)
    }
  }

  async function uploadForDocRequest(req: DocumentRequest, file: File) {
    if (!id || !app?.companyId) return
    setBusyId(req.id)
    setError(null)
    try {
      await uploadCompanyApplicationDocument(app.companyId, app.id, file, {
        docType: req.docType,
        documentRequestId: req.id,
      })
      await qc.invalidateQueries({ queryKey: ['application', id] })
      await qc.invalidateQueries({ queryKey: ['application', id, 'document-requests'] })
      showFlash(`Ответ на запрос «${req.label || req.docType}» отправлен`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось ответить на запрос документов')
    } finally {
      setBusyId(null)
      setActiveDocReq(null)
    }
  }

  function onPick(slotId: string, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    void attachFile(slotId, file)
  }

  function onBulk(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const target =
      slots.find((s) => s.status === 'needed') ?? slots.find((s) => s.status === 'optional')
    if (!target) {
      showFlash('Все слоты заполнены — нажмите «Заменить» у нужного документа')
      return
    }
    void attachFile(target.id, file)
  }

  const code = appCode(app.id)
  const activeOffers = (offersQ.data ?? []).filter((o) => isLiveOffer(o))
  const bankOffer = activeOffers[0]
  const decision = decisionQ.data as PublicDecision | null | undefined
  const openDocReqs = (docReqsQ.data ?? []).filter((r) =>
    ['OPEN', 'PENDING', 'REQUESTED'].includes(r.status.toUpperCase()),
  )
  const requestedAmount = app.amount
  const offerAmount = bankOffer?.amount
  const offerRate = bankOffer?.rate
  const offerTerm = bankOffer?.termMonths
  const monthly = bankOffer
    ? bankOffer.monthlyPayment ||
      estimateMonthly(bankOffer.amount, bankOffer.termMonths, bankOffer.rate || 0)
    : 0
  const step = pipelineStep(app.status)
  const statusChip = APP_STATUS_CHIP[app.status] ?? APP_STATUS_CHIP.submitted
  const statusLabel = statusLabels[app.status] ?? String(app.status)
  const blockMsg = !docsReady
    ? `Нужны ещё: ${missingTitles.slice(0, 2).join(' и ')}${missingTitles.length > 2 ? '…' : ''}`
    : null
  const decisionReady = Boolean(
    decision ||
      activeOffers.length > 0 ||
      ['approved', 'counteroffered', 'rejected', 'in_review', 'docs_requested'].includes(app.status),
  )

  async function loadExplanation() {
    if (!id || explanationLoading) return
    setExplanationLoading(true)
    setExplanationError(null)
    try {
      const res = await fetchApplicationExplanation(id)
      setExplanation(res)
    } catch (e) {
      setExplanation(null)
      setExplanationError(formatAiError(e, 'Не удалось загрузить объяснение'))
    } finally {
      setExplanationLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/applications"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Мои заявки
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          {code}
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
            {app.purpose || app.productName}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.85 }}>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                px: 1,
                py: 0.35,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                bgcolor: statusChip.bg,
                color: statusChip.color,
              }}
            >
              {statusLabel}
            </Box>
            <Typography sx={{ fontSize: 13, color: '#7A8795' }}>
              {app.productName} · готовность {readiness}/100 · обновлено{' '}
              {formatDateTime(app.updatedAt)}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            component={RouterLink}
            to="/app/applications"
            variant="outlined"
            sx={{
              borderRadius: 2,
              borderColor: 'rgba(11,31,53,0.16)',
              color: '#0B1F35',
              fontWeight: 700,
              bgcolor: '#fff',
              textTransform: 'none',
            }}
          >
            ← К списку
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              persist(slots)
              showFlash('Черновик сохранён')
            }}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Сохранить
          </Button>
        </Stack>
      </Stack>

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
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {app.aiSummary && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            borderRadius: 2.5,
            bgcolor: '#E8F1FB',
            color: '#1A4A7A',
            border: '1px solid rgba(26,74,122,0.12)',
            '& .MuiAlert-icon': { color: '#2B6CB0' },
          }}
        >
          {app.aiSummary}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.75,
          gridTemplateColumns: { xs: '1fr', lg: '1.55fr 0.85fr' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.75}>
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
              Условия заявки
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Meta label="Запрошено" value={shortMoney(requestedAmount)} />
              <Meta label="Срок запроса" value={`${app.termMonths} мес.`} />
              <Meta
                label="Предложено"
                value={
                  bankOffer && offerAmount != null
                    ? shortMoney(offerAmount)
                    : decision
                      ? String(decision.decision)
                      : 'Ожидает решения'
                }
                accent={Boolean(bankOffer)}
              />
              <Meta
                label="Условия оффера"
                value={
                  bankOffer
                    ? `${offerTerm ?? '—'} мес · ${(offerRate ?? 0).toFixed(1)}% · ≈ ${shortMoney(monthly)}`
                    : '—'
                }
              />
            </Box>
            {bankOffer && offerAmount != null && offerAmount !== requestedAmount && (
              <Typography sx={{ fontSize: 13, color: '#C45A12', fontWeight: 650, mb: 1.5 }}>
                Запрошено {shortMoney(requestedAmount)}, предложено {shortMoney(offerAmount)}
              </Typography>
            )}
            <Pipeline current={step} status={app.status} />
          </Box>

          {(decision || activeOffers.length > 0) && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.25,
                }}
              >
                Решение банка
              </Typography>
              {decision && (
                <Box sx={{ mb: 1.75 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                    {decision.decision}
                    {decision.policyVersion ? ` · ${decision.policyVersion}` : ''}
                  </Typography>
                  {decision.explanation && (
                    <Typography sx={{ mt: 0.75, fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.45 }}>
                      {decision.explanation}
                    </Typography>
                  )}
                  {decision.reasonCodes.length > 0 && (
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {decision.reasonCodes.map((r) => (
                        <Typography key={r.code} sx={{ fontSize: 12.5, color: '#7A8795' }}>
                          {r.title}
                          {r.details ? ` — ${r.details}` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
              {activeOffers.map((offer) => (
                <Box
                  key={offer.id}
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    bgcolor: '#F7F8FA',
                    border: '1px solid rgba(11,31,53,0.06)',
                    mb: 1.25,
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                    {offer.label || (offer.isAlternative ? 'Альтернатива' : 'Основное предложение')}
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 13.5, color: '#5A6B7D' }}>
                    {shortMoney(offer.amount)} · {offer.termMonths} мес · {offer.rate.toFixed(1)}% ·
                    платёж ≈ {shortMoney(offer.monthlyPayment || 0)}
                  </Typography>
                  {offer.expiresAt && (
                    <Typography sx={{ mt: 0.35, fontSize: 12, color: '#8A96A3' }}>
                      Действует до {formatDateTime(offer.expiresAt)}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={acceptM.isPending}
                      onClick={() => acceptM.mutate(offer)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: 'none',
                      }}
                    >
                      Принять
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={declineM.isPending}
                      onClick={() => declineM.mutate(offer)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        borderColor: 'rgba(11,31,53,0.16)',
                        color: '#0B1F35',
                      }}
                    >
                      Отклонить
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Box>
          )}

          {decisionReady && (
            <Box sx={tileSx}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1.25}
                sx={{ mb: 1.25 }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 16,
                    color: '#0B1F35',
                  }}
                >
                  Почему такое решение
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    disabled={explanationLoading}
                    onClick={() => void loadExplanation()}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      textTransform: 'none',
                      borderColor: 'rgba(11,31,53,0.16)',
                      color: '#0B1F35',
                    }}
                  >
                    {explanationLoading ? (
                      <CircularProgress size={18} />
                    ) : explanation ? (
                      'Обновить'
                    ) : (
                      'Показать объяснение'
                    )}
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/app/ai?applicationId=${encodeURIComponent(app.id)}`}
                    variant="contained"
                    color="primary"
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: 'none',
                    }}
                  >
                    Задать вопрос по заявке
                  </Button>
                </Stack>
              </Stack>
              {explanationError && (
                <Alert severity="error" sx={{ mb: 1.25, borderRadius: 2 }}>
                  {explanationError}
                </Alert>
              )}
              {explanation ? (
                <AiAgentReply data={explanation} />
              ) : (
                !explanationLoading &&
                !explanationError && (
                  <Typography sx={{ fontSize: 13.5, color: '#7A8795' }}>
                    Загрузите объяснение решения или задайте вопрос в чате по этой заявке.
                  </Typography>
                )
              )}
            </Box>
          )}

          {app.statusHistory.length > 0 && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.25,
                }}
              >
                История статусов
              </Typography>
              <Stack spacing={0.85}>
                {[...app.statusHistory].reverse().map((h, i) => (
                  <Stack
                    key={`${h.status}-${h.at}-${i}`}
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{
                      py: 0.65,
                      borderBottom:
                        i < app.statusHistory.length - 1
                          ? '1px solid rgba(11,31,53,0.06)'
                          : 'none',
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
                      {statusLabels[h.status] ?? h.status}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#8A96A3', flexShrink: 0 }}>
                      {formatDateTime(h.at)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {openDocReqs.length > 0 && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.25,
                }}
              >
                Запросы банка по документам
              </Typography>
              <Stack spacing={1.1}>
                {openDocReqs.map((req) => (
                  <Stack
                    key={req.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    spacing={1}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: '#FDE8E6',
                      border: '1px solid rgba(239,49,36,0.12)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                        {req.label || req.docType}
                      </Typography>
                      {req.comment && (
                        <Typography sx={{ fontSize: 12.5, color: '#5A6B7D', mt: 0.35 }}>
                          {req.comment}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={busyId === req.id}
                      onClick={() => {
                        setActiveDocReq(req)
                        docReqFileRef.current?.click()
                      }}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {busyId === req.id ? <CircularProgress size={18} color="inherit" /> : 'Загрузить'}
                    </Button>
                  </Stack>
                ))}
              </Stack>
              <input
                ref={docReqFileRef}
                hidden
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && activeDocReq) void uploadForDocRequest(activeDocReq, file)
                  e.target.value = ''
                }}
              />
            </Box>
          )}

          <Box sx={tileSx} id="documents">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={1.5}
              sx={{ mb: 1.25 }}
            >
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 16,
                    color: '#0B1F35',
                    mb: 0.35,
                  }}
                >
                  Документы по заявке
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>
                  {doneRequired} из {required.length} обязательных
                  {waiting > 0 ? ` · ${waiting} ждут загрузки` : ' · комплект собран'}
                  {' · '}
                  PDF, JPEG, PNG, XML
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => bulkRef.current?.click()}
                sx={{
                  borderRadius: 2,
                  borderColor: 'rgba(239,49,36,0.45)',
                  color: '#EF3124',
                  fontWeight: 700,
                  bgcolor: '#fff',
                  textTransform: 'none',
                }}
              >
                Загрузить файл
              </Button>
              <input
                ref={bulkRef}
                hidden
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  onBulk(e.target.files)
                  e.target.value = ''
                }}
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 999,
                mb: 1.75,
                bgcolor: 'rgba(11,31,53,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: '#EF3124', borderRadius: 999 },
              }}
            />

            <Stack spacing={1.1}>
              {slots.map((slot) => (
                <DocRow
                  key={slot.id}
                  slot={slot}
                  busy={busyId === slot.id}
                  dragging={dragId === slot.id}
                  setDragging={(v) => setDragId(v ? slot.id : null)}
                  onPick={(files) => onPick(slot.id, files)}
                  onDownload={() => showFlash(`Скачивание: ${slot.fileName}`)}
                />
              ))}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              История
            </Typography>
            {app.statusHistory.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: '#8A96A3' }}>Пока нет событий.</Typography>
            ) : (
              <Stack spacing={0}>
                {app.statusHistory.map((h, i) => (
                  <Stack
                    key={`${h.at}-${i}`}
                    direction="row"
                    spacing={1.25}
                    sx={{
                      py: 1.1,
                      borderBottom:
                        i < app.statusHistory.length - 1
                          ? '1px solid rgba(11,31,53,0.06)'
                          : 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: i === 0 ? '#EF3124' : 'rgba(11,31,53,0.2)',
                        mt: 0.7,
                        flexShrink: 0,
                      }}
                    />
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
                        {statusLabels[h.status] ?? String(h.status)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>
                        {formatDateTime(String(h.at))} · {h.by}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(11,31,53,0.06)' }} id="chat">
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35', mb: 1 }}>
                Переписка с банком
              </Typography>
              {(commentsQ.data ?? app.comments).length === 0 ? (
                <Typography sx={{ fontSize: 13, color: '#8A96A3', mb: 1.25 }}>
                  Пока нет сообщений. Можете задать вопрос аналитику ниже.
                </Typography>
              ) : (
                <Stack spacing={0.85} sx={{ mb: 1.5 }}>
                  {(commentsQ.data ?? app.comments).map((c) => (
                    <Box
                      key={c.id}
                      sx={{
                        p: 1.1,
                        borderRadius: 2,
                        bgcolor: '#F7F8FA',
                        border: '1px solid rgba(11,31,53,0.05)',
                      }}
                    >
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0B1F35' }}>
                        {c.authorName}
                        {'createdAt' in c && c.createdAt ? (
                          <Box component="span" sx={{ fontWeight: 600, color: '#8A96A3' }}>
                            {' '}
                            · {formatDateTime(String(c.createdAt))}
                          </Box>
                        ) : null}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: '#5A6B7D', mt: 0.35 }}>{c.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Вопрос банку: сроки, документы, условия…"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!chatText.trim() || chatM.isPending || !companyId}
                  onClick={() => chatM.mutate()}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: 'none',
                    alignSelf: { sm: 'flex-end' },
                    minWidth: 120,
                  }}
                >
                  {chatM.isPending ? <CircularProgress size={18} color="inherit" /> : 'Отправить'}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Stack>

        <Stack spacing={1.75} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              Следующий шаг
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.45, mb: 1.5 }}>
              {openDocReqs.length > 0
                ? `Банк запросил документы (${openDocReqs.length}). Загрузите файлы выше — статус вернётся в работу.`
                : bankOffer
                  ? 'Есть активное предложение банка — примите или отклоните условия.'
                  : docsReady
                    ? 'Обязательные документы на месте. Можно дождаться решения банка.'
                    : 'Загрузите обязательные файлы — индекс готовности вырастет.'}
            </Typography>
            {blockMsg && (
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#C41E14', mb: 1.5 }}>
                {blockMsg}
              </Typography>
            )}
            <Stack spacing={1}>
              <Button
                variant="contained"
                color="primary"
                disabled={!docsReady}
                onClick={() =>
                  showFlash(
                    docsReady
                      ? 'Готово к проверке — менеджер получит комплект'
                      : 'Сначала загрузите обязательные документы',
                  )
                }
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                  opacity: docsReady ? 1 : 0.45,
                  '&.Mui-disabled': { bgcolor: '#EF3124', color: '#fff' },
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                К проверке перед отправкой
              </Button>
              {(app.status === 'approved' || app.status === 'counteroffered') && bankOffer && (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={acceptM.isPending}
                  onClick={() => acceptM.mutate(bankOffer)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: 'none',
                  }}
                >
                  Принять предложение банка
                </Button>
              )}
              {app.status === 'issued' && (
                <Button
                  component={RouterLink}
                  to={`/app/applications/${app.id}/contract`}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: 'rgba(11,31,53,0.16)',
                    color: '#0B1F35',
                    fontWeight: 700,
                    bgcolor: '#fff',
                    textTransform: 'none',
                  }}
                >
                  Открыть договор
                </Button>
              )}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography sx={{ fontSize: 12, color: '#8A96A3', mb: 0.5, fontWeight: 600 }}>
              Номер заявки
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 750, color: '#0B1F35', mb: 1.5 }}>
              {code}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#8A96A3', mb: 0.5, fontWeight: 600 }}>
              Создана
            </Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
              {formatDateTime(app.createdAt)}
            </Typography>
            {app.assignedManagerName && (
              <>
                <Typography sx={{ fontSize: 12, color: '#8A96A3', mb: 0.5, mt: 1.5, fontWeight: 600 }}>
                  Менеджер
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                  {app.assignedManagerName}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

function Meta({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#8A96A3', mb: 0.35 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 700,
          color: accent ? '#1B8A5A' : '#0B1F35',
          lineHeight: 1.25,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function Pipeline({ current, status }: { current: number; status: ApplicationStatus }) {
  const labels = ['Подана', 'Проверка', 'Скоринг', 'Менеджер', 'Решение']
  return (
    <Stack direction="row" alignItems="flex-start" spacing={0.5}>
      {labels.map((label, i) => {
        const done =
          i < current ||
          (i === current &&
            [
              'approved',
              'counteroffered',
              'offer_accepted',
              'agreement_preparation',
              'issued',
            ].includes(status))
        const active =
          i === current &&
          ![
            'approved',
            'counteroffered',
            'offer_accepted',
            'agreement_preparation',
            'issued',
            'rejected',
          ].includes(status)
        const failed = status === 'rejected' && i === current
        return (
          <Box key={label} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                mx: 'auto',
                display: 'grid',
                placeItems: 'center',
                bgcolor: failed
                  ? '#EF3124'
                  : done
                    ? '#1B8A5A'
                    : active
                      ? '#EF3124'
                      : 'rgba(11,31,53,0.08)',
                color: done || active || failed ? '#fff' : '#8A96A3',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {done && !failed ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : i + 1}
            </Box>
            <Typography
              sx={{
                mt: 0.75,
                fontSize: 10,
                textAlign: 'center',
                color: active || done ? '#0B1F35' : '#8A96A3',
                fontWeight: active ? 700 : 500,
                lineHeight: 1.2,
              }}
            >
              {label}
            </Typography>
          </Box>
        )
      })}
    </Stack>
  )
}

function DocRow({
  slot,
  busy,
  dragging,
  setDragging,
  onPick,
  onDownload,
}: {
  slot: AppDocSlot
  busy: boolean
  dragging: boolean
  setDragging: (v: boolean) => void
  onPick: (files: FileList | null) => void
  onDownload: () => void
}) {
  const ui = DOC_STATUS_UI[slot.status]
  const needsUpload = slot.status === 'needed' || slot.status === 'optional'
  const hasFile = Boolean(slot.fileName)
  const inputRef = useRef<HTMLInputElement>(null)

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    onPick(e.dataTransfer.files)
  }

  return (
    <Box
      sx={{
        bgcolor: '#F7F8FA',
        borderRadius: 2.5,
        border: '1px solid rgba(11,31,53,0.05)',
        p: 1.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction="row" spacing={1.15} alignItems="flex-start" sx={{ flex: 1.15, minWidth: 0 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              bgcolor: ui.iconBg,
              color: ui.iconColor,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {slot.status === 'uploaded' && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
            {slot.status === 'needed' && <PriorityHighRoundedIcon sx={{ fontSize: 18 }} />}
            {slot.status === 'review' && <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />}
            {slot.status === 'optional' && <AddRoundedIcon sx={{ fontSize: 18 }} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0B1F35' }}>
                {slot.title}
              </Typography>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  px: 0.85,
                  py: 0.25,
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: ui.bg,
                  color: ui.color,
                }}
              >
                {ui.label}
              </Box>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#8A96A3', mt: 0.2 }}>{slot.hint}</Typography>
            {hasFile && (
              <Typography sx={{ fontSize: 12.5, color: '#5A6B7D', mt: 0.4, fontWeight: 600 }}>
                {slot.fileName}
                {slot.fileSizeLabel ? ` · ${slot.fileSizeLabel}` : ''}
              </Typography>
            )}
          </Box>
        </Stack>

        {needsUpload && !hasFile ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems="stretch"
            sx={{ flex: 1, minWidth: 0 }}
          >
            <Box
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              sx={{
                flex: 1,
                border: '1.5px dashed',
                borderColor: dragging ? '#EF3124' : 'rgba(11,31,53,0.16)',
                bgcolor: dragging ? 'rgba(239,49,36,0.04)' : '#fff',
                borderRadius: 2,
                px: 1.25,
                py: 1,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                '&:hover': { borderColor: '#EF3124' },
              }}
            >
              <Typography sx={{ fontSize: 12.5, color: '#5A6B7D', fontWeight: 600 }}>
                Перетащите или выберите
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              sx={{ borderRadius: 2, fontWeight: 700, minWidth: 110, textTransform: 'none' }}
            >
              {busy ? '…' : 'Загрузить'}
            </Button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                onPick(e.target.files)
                e.target.value = ''
              }}
            />
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              sx={{
                borderRadius: 2,
                borderColor: 'rgba(11,31,53,0.16)',
                color: '#0B1F35',
                fontWeight: 600,
                bgcolor: '#fff',
                textTransform: 'none',
              }}
            >
              Заменить
            </Button>
            {hasFile && slot.status !== 'review' && (
              <Button
                variant="text"
                onClick={onDownload}
                sx={{ fontWeight: 600, color: '#5A6B7D', textTransform: 'none' }}
              >
                Скачать
              </Button>
            )}
            <input
              ref={inputRef}
              hidden
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                onPick(e.target.files)
                e.target.value = ''
              }}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
