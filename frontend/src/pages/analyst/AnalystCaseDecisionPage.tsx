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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { proposeAnalystDecision, type AnalystProposeIn } from '@/api/analyst'
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

export function AnalystCaseDecisionPage() {
  const { caseData: c, card, applicationId } = useOutletContext<AnalystCaseOutlet>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const app = card.application
  const cs = card.checksSummary
  const base = `/app/analyst/cases/${c.id}`

  const [decision, setDecision] = useState<AnalystProposeIn['decision']>('APPROVED')
  const [explanation, setExplanation] = useState('')
  const [comment, setComment] = useState('')
  const [offerAmount, setOfferAmount] = useState(String(app.amount || ''))
  const [offerTerm, setOfferTerm] = useState(String(app.termMonths || ''))
  const [offerRate, setOfferRate] = useState(String(app.rate || ''))
  const [forceApprove, setForceApprove] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allowed = card.allowedActions
  const needsOffer = decision === 'APPROVED' || decision === 'COUNTEROFFERED'
  const openDocs = card.openDocumentRequests.length
  const incomplete = openDocs > 0 || cs.warnings > 0 || cs.failed > 0
  const approveBlocked = decision === 'APPROVED' && incomplete && !forceApprove

  const gateReasons = useMemo(() => {
    const r: string[] = []
    if (openDocs > 0) r.push(`ожидаются документы (${openDocs})`)
    if (cs.warnings > 0) r.push(`есть замечания по проверкам (${cs.warnings})`)
    if (cs.failed > 0) r.push(`есть ошибки проверок (${cs.failed})`)
    return r
  }, [openDocs, cs.failed, cs.warnings])

  const decisionLabel = DECISIONS.find((d) => d.value === decision)?.label ?? decision
  const statusRu = analystStatusLabel(app.statusLabel || app.status)
  const stepRu = analystStepLabel(app.currentStep) || c.nextStep || '—'

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

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) 300px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
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

        {incomplete && decision === 'APPROVED' && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={() => setForceApprove((v) => !v)}
              >
                {forceApprove ? 'Отменить' : 'Всё равно одобрить'}
              </Button>
            }
          >
            Пока нельзя одобрить: {gateReasons.join(', ')}. Закройте замечания или выберите другое
            решение.
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
              disabled={proposeM.isPending || approveBlocked}
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
                setForceApprove(false)
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
                <Typography key={String(row.id ?? i)} sx={{ fontSize: 13, color: '#5A6B7D', mb: 0.5 }}>
                  {analystOfferStatusLabel(String(row.status))} · {formatMoney(amount)} · {term} мес ·{' '}
                  {rate}%
                </Typography>
              )
            })}
          </Box>
        )}
      </Box>

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
          {openDocs > 0 && (
            <Button
              fullWidth
              variant="outlined"
              sx={outlineBtn}
              onClick={() => navigate(`${base}/documents`)}
            >
              К документам
            </Button>
          )}
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
            onClick={() => navigate(`${base}/chat`)}
          >
            Чат с клиентом
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
