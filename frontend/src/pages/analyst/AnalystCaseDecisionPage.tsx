import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  fetchAnalystAgreement,
  fetchAnalystAgreementPdfBlob,
  proposeAnalystDecision,
  sendAnalystAgreement,
  type AnalystProposeIn,
} from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import {
  analystOfferStatusLabel,
  analystStatusLabel,
  analystStepLabel,
  formatCompactMoney,
} from '@/features/analyst/map'
import { outlineBtn, primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'
import { formatMoney } from '@/utils/format'

const DECISIONS: { value: AnalystProposeIn['decision']; label: string; action?: string }[] = [
  { value: 'APPROVED', label: 'Одобрить', action: 'APPROVE' },
  { value: 'REJECTED', label: 'Отклонить', action: 'REJECT' },
  { value: 'COUNTEROFFERED', label: 'Контрпредложение', action: 'COUNTEROFFER' },
  { value: 'NEED_INFO', label: 'Нужна информация', action: 'NEED_INFO' },
]

const AGREEMENT_STATUSES = new Set([
  'OFFER_ACCEPTED',
  'AGREEMENT_PREPARATION',
  'ISSUED',
])

export function AnalystCaseDecisionPage() {
  const { caseData: c, card, applicationId } = useOutletContext<AnalystCaseOutlet>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const app = card.application
  const cs = card.checksSummary
  const base = `/app/analyst/cases/${c.id}`
  const statusUp = (app.statusLabel || app.status || '').toUpperCase()
  const agreementStage = AGREEMENT_STATUSES.has(statusUp) || card.allowedActions.includes('SEND_AGREEMENT')

  const [decision, setDecision] = useState<AnalystProposeIn['decision']>('APPROVED')
  const [explanation, setExplanation] = useState('')
  const [comment, setComment] = useState('')
  const [offerAmount, setOfferAmount] = useState(String(app.amount || ''))
  const [offerTerm, setOfferTerm] = useState(String(app.termMonths || ''))
  const [offerRate, setOfferRate] = useState(String(app.rate || ''))
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const allowed = card.allowedActions
  const needsOffer = decision === 'APPROVED' || decision === 'COUNTEROFFERED'
  const openDocs = card.openDocumentRequests.length
  // Soft hints only — never hard-block APPROVE on warnings / open docs
  const softHints = useMemo(() => {
    const r: string[] = []
    if (openDocs > 0) r.push(`открытых запросов документов: ${openDocs}`)
    if (cs.warnings > 0) r.push(`замечаний по проверкам: ${cs.warnings}`)
    if (cs.failed > 0) r.push(`ошибок проверок: ${cs.failed}`)
    return r
  }, [openDocs, cs.failed, cs.warnings])

  const decisionLabel = DECISIONS.find((d) => d.value === decision)?.label ?? decision
  const statusRu = analystStatusLabel(app.statusLabel || app.status)
  const stepRu = analystStepLabel(app.currentStep) || c.nextStep || '—'

  const agreementQ = useQuery({
    queryKey: ['analyst', 'agreement', applicationId],
    queryFn: () => fetchAnalystAgreement(applicationId),
    enabled: Boolean(applicationId) && agreementStage,
    staleTime: 0,
  })

  useEffect(() => {
    if (!agreementStage || !applicationId) return
    let revoked = false
    let url: string | null = null
    void fetchAnalystAgreementPdfBlob(applicationId)
      .then((blob) => {
        if (revoked) return
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      })
      .catch(() => {
        if (!revoked) setPdfUrl('/demo/contract_ABC-775C68EB.pdf')
      })
    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [agreementStage, applicationId])

  const proposeM = useMutation({
    mutationFn: () =>
      proposeAnalystDecision(applicationId, {
        decision,
        explanation: explanation.trim() || undefined,
        comment: comment.trim() || undefined,
        offerAmount: needsOffer ? Number(offerAmount) : undefined,
        offerTermMonths: needsOffer ? Number(offerTerm) : undefined,
        offerRate: needsOffer ? Number(offerRate) : undefined,
        productId: app.productId || undefined,
      }),
    onSuccess: () => {
      setError(null)
      setResult(`Решение «${decisionLabel}» отправлено клиенту`)
      void qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
      void qc.invalidateQueries({ queryKey: ['analyst', 'queue'] })
      void qc.invalidateQueries({ queryKey: ['application'] })
      void qc.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Не удалось отправить решение'
      setError(msg)
      setResult(null)
    },
  })

  const sendM = useMutation({
    mutationFn: () => sendAnalystAgreement(applicationId),
    onSuccess: () => {
      setError(null)
      setResult('Договор отправлен предпринимателю на согласование')
      void qc.invalidateQueries({ queryKey: ['analyst', 'agreement', applicationId] })
      void qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Не удалось отправить договор'
      setError(msg)
      setResult(null)
    },
  })

  const agreement = agreementQ.data

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) 300px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Stack spacing={2}>
        {agreementStage && (
          <Box sx={tileSx}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
              Кредитный договор
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#8A96A3', mt: 0.35, mb: 1.5 }}>
              Предпросмотр PDF → отправка предпринимателю. Он может назначить помощника на разбор;
              финальное согласование — только у владельца.
            </Typography>

            {(result || error) && (
              <Alert
                severity={error ? 'error' : 'success'}
                sx={{ mb: 1.5 }}
                onClose={() => {
                  setResult(null)
                  setError(null)
                }}
              >
                {error || result}
              </Alert>
            )}

            {agreementQ.isLoading && (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress size={28} sx={{ color: '#EF3124' }} />
              </Box>
            )}

            {agreement && (
              <Stack spacing={1} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 13.5, color: '#0B1F35', fontWeight: 650 }}>
                  {agreement.number || agreement.id.slice(0, 8)} · {formatMoney(agreement.amount)} ·{' '}
                  {agreement.termMonths} мес · {agreement.rate}%
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>
                  Статус:{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: '#0B1F35' }}>
                    {agreement.confirmed
                      ? 'Согласован владельцем'
                      : agreement.sentAt
                        ? 'Отправлен клиенту'
                        : 'Готов к отправке'}
                  </Box>
                  {agreement.helperApproved ? ' · помощник рекомендовал согласовать' : ''}
                </Typography>
              </Stack>
            )}

            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(11,31,53,0.08)',
                bgcolor: '#F7F8FA',
                height: { xs: 360, md: 480 },
                mb: 1.75,
              }}
            >
              {pdfUrl ? (
                <Box
                  component="iframe"
                  title="Договор PDF"
                  src={pdfUrl}
                  sx={{ width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                  <CircularProgress size={24} sx={{ color: '#EF3124' }} />
                </Box>
              )}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                sx={primaryBtn}
                disabled={sendM.isPending || Boolean(agreement?.confirmed)}
                onClick={() => sendM.mutate()}
              >
                {sendM.isPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : agreement?.sentAt && !agreement.confirmed ? (
                  'Отправить повторно'
                ) : (
                  'Отправить на согласование'
                )}
              </Button>
              <Button
                variant="outlined"
                sx={outlineBtn}
                disabled={!pdfUrl}
                onClick={() => {
                  if (!pdfUrl) return
                  const a = document.createElement('a')
                  a.href = pdfUrl
                  a.download = `agreement_${agreement?.number || applicationId}.pdf`
                  a.click()
                }}
              >
                Скачать PDF
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1.25, lineHeight: 1.45 }}>
              {agreement?.disclaimer ||
                'Демонстрационный договор, не имеет юридической силы.'}
            </Typography>
          </Box>
        )}

        {!agreementStage && (
          <Box sx={tileSx}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
              Решение по заявке
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#8A96A3', mt: 0.35, mb: 2.25 }}>
              {c.number || c.id} · {c.company} · {formatMoney(c.amount)}
            </Typography>

            {(result || error) && (
              <Alert
                severity={error ? 'error' : 'success'}
                sx={{ mb: 2 }}
                onClose={() => {
                  setResult(null)
                  setError(null)
                }}
              >
                {error || result}
              </Alert>
            )}

            {softHints.length > 0 && decision === 'APPROVED' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Есть замечания ({softHints.join('; ')}), но одобрить всё равно можно — комплект
                документов не блокирует решение в демо.
              </Alert>
            )}

            <Stack spacing={1.75}>
              <TextField
                select
                label="Решение"
                size="small"
                value={decision}
                onChange={(e) => setDecision(e.target.value as AnalystProposeIn['decision'])}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                {DECISIONS.map((d) => {
                  const locked = d.action ? !allowed.includes(d.action) : false
                  return (
                    <MenuItem key={d.value} value={d.value} disabled={locked}>
                      {d.label}
                      {locked ? ' (недоступно)' : ''}
                    </MenuItem>
                  )
                })}
              </TextField>

              {needsOffer && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="Сумма оффера"
                    size="small"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <TextField
                    label="Срок, мес"
                    size="small"
                    value={offerTerm}
                    onChange={(e) => setOfferTerm(e.target.value)}
                    sx={{ width: { sm: 120 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <TextField
                    label="Ставка %"
                    size="small"
                    value={offerRate}
                    onChange={(e) => setOfferRate(e.target.value)}
                    sx={{ width: { sm: 120 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Stack>
              )}

              <TextField
                label="Пояснение клиенту"
                multiline
                minRows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                label="Внутренний комментарий"
                multiline
                minRows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  sx={primaryBtn}
                  disabled={proposeM.isPending}
                  onClick={() => proposeM.mutate()}
                >
                  {proposeM.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    'Отправить решение'
                  )}
                </Button>
                <Button
                  variant="outlined"
                  sx={outlineBtn}
                  onClick={() => {
                    setDecision('APPROVED')
                    setExplanation('')
                    setComment('')
                    setOfferAmount(String(app.amount || ''))
                    setOfferTerm(String(app.termMonths || ''))
                    setOfferRate(String(app.rate || ''))
                  }}
                >
                  Сбросить
                </Button>
              </Stack>
            </Stack>

            {card.offers.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1 }}>
                  Предложения клиенту
                </Typography>
                {card.offers.map((o, i) => {
                  const row = o as Record<string, unknown>
                  const amount = Number(row.amount ?? 0)
                  const term = Number(row.termMonths ?? row.term_months ?? 0)
                  const rate = Number(row.rate ?? 0)
                  return (
                    <Typography
                      key={String(row.id ?? i)}
                      sx={{ fontSize: 13, color: '#5A6B7D', mb: 0.5 }}
                    >
                      {analystOfferStatusLabel(String(row.status))} · {formatMoney(amount)} · {term}{' '}
                      мес · {rate}%
                    </Typography>
                  )
                })}
              </Box>
            )}
          </Box>
        )}
      </Stack>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          По заявке
        </Typography>

        <Stack spacing={1.35} sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: '#8A96A3', mb: 0.5 }}>Статус</Typography>
            <Box
              component="span"
              sx={{
                ...statusPill,
                bgcolor: 'rgba(239,49,36,0.08)',
                color: '#EF3124',
              }}
            >
              {statusRu}
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>Этап</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35', mt: 0.25 }}>
              {stepRu}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>Проверки</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35', mt: 0.25 }}>
              {cs.passed} ок
              {cs.warnings ? ` · ${cs.warnings} замечаний` : ''}
              {cs.failed ? ` · ${cs.failed} ошибок` : !cs.warnings ? ' · замечаний нет' : ''}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>Документы</Typography>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 700,
                color: openDocs > 0 ? '#C45A12' : '#0B1F35',
                mt: 0.25,
              }}
            >
              {openDocs > 0 ? `Ожидаем ответы: ${openDocs}` : 'Открытых запросов нет'}
            </Typography>
          </Box>

          {app.amount > 0 && (
            <Box>
              <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>Запрос клиента</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35', mt: 0.25 }}>
                {formatCompactMoney(app.amount)} · {app.termMonths || '—'} мес
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack spacing={1}>
          {(cs.warnings > 0 || cs.failed > 0) && (
            <Button
              fullWidth
              variant="outlined"
              sx={outlineBtn}
              onClick={() => navigate(`${base}/checks`)}
            >
              К проверкам
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/documents`)}
          >
            К документам
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/ai`)}
          >
            Чат с клиентом
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
