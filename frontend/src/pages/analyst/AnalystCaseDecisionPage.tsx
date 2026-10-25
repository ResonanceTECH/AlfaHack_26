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
import { useOutletContext } from 'react-router-dom'
import { proposeAnalystDecision, type AnalystProposeIn } from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
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
  const qc = useQueryClient()
  const app = card.application
  const cs = card.checksSummary

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
  const incomplete =
    card.openDocumentRequests.length > 0 || cs.warnings > 0 || cs.failed > 0
  const approveBlocked = decision === 'APPROVED' && incomplete && !forceApprove

  const gateReasons = useMemo(() => {
    const r: string[] = []
    if (card.openDocumentRequests.length > 0) {
      r.push(`открытых запросов документов: ${card.openDocumentRequests.length}`)
    }
    if (cs.warnings > 0) r.push(`warnings: ${cs.warnings}`)
    if (cs.failed > 0) r.push(`failed checks: ${cs.failed}`)
    return r
  }, [card.openDocumentRequests.length, cs.failed, cs.warnings])

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
    onSuccess: (data) => {
      setError(null)
      setResult(
        `Решение ${String(data.decisionType ?? data.decision_type ?? decision)} · статус ${String(data.status)}`,
      )
      void qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
      void qc.invalidateQueries({ queryKey: ['analyst', 'queue'] })
      void qc.invalidateQueries({ queryKey: ['application'] })
      void qc.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Ошибка propose'
      setError(msg)
      setResult(null)
    },
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) 280px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
          Решение по заявке
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#8A96A3', mt: 0.35, mb: 2.25 }}>
          {c.number || c.id} · {c.company} · {formatMoney(c.amount)} · POST /analyst/…/propose
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
          <Alert severity="warning" sx={{ mb: 2 }}>
            Комплект неполный ({gateReasons.join(' · ')}). APPROVE заблокирован — закройте замечания,
            выберите REJECT/COUNTEROFFER/NEED_INFO или подтвердите override.
            <Button
              size="small"
              sx={{ ml: 1, textTransform: 'none', fontWeight: 700 }}
              onClick={() => setForceApprove((v) => !v)}
            >
              {forceApprove ? 'Override выкл' : 'Override APPROVE'}
            </Button>
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
            label="Пояснение (клиенту)"
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
              Существующие офферы
            </Typography>
            {card.offers.map((o, i) => {
              const row = o as Record<string, unknown>
              return (
                <Typography key={String(row.id ?? i)} sx={{ fontSize: 13, color: '#5A6B7D', mb: 0.5 }}>
                  {String(row.status)} · {String(row.amount)} ₽ ·{' '}
                  {String(row.termMonths ?? row.term_months)} мес · {String(row.rate)}%
                </Typography>
              )
            })}
          </Box>
        )}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.25 }}>
          Доступные действия
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mb: 2 }}>
          {allowed.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#8A96A3' }}>—</Typography>
          ) : (
            allowed.map((a) => (
              <Box
                key={a}
                sx={{
                  ...statusPill,
                  bgcolor: 'rgba(239,49,36,0.08)',
                  color: '#EF3124',
                }}
              >
                {a}
              </Box>
            ))
          )}
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: '#8A96A3', lineHeight: 1.45 }}>
          Статус: {app.statusLabel}
          <br />
          Шаг: {app.currentStep || '—'}
          <br />
          Checks: {cs.passed}P / {cs.warnings}W / {cs.failed}F
        </Typography>
      </Box>
    </Box>
  )
}
