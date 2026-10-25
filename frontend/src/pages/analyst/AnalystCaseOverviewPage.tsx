import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { assignAnalystApplication } from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { useAuth } from '@/contexts/AuthContext'
import { formatCompactMoney } from '@/features/analyst/map'
import { outlineBtn, primaryBtn, tileSx } from '@/features/analyst/styles'

export function AnalystCaseOverviewPage() {
  const { caseData: c, card, applicationId } = useOutletContext<AnalystCaseOutlet>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const base = `/app/analyst/cases/${c.id}`
  const fin = card.financials
  const cs = card.checksSummary
  const [flash, setFlash] = useState<string | null>(null)

  const assignedToMe = card.application.assignedManagerId === user?.id
  const canAssign = card.allowedActions.includes('ASSIGN')
  const docsBlocked =
    card.openDocumentRequests.length > 0 || cs.failed > 0 || cs.warnings > 0

  const finLine = fin
    ? `Выручка ${formatCompactMoney(fin.avgMonthlyRevenue)}/мес · расходы ${formatCompactMoney(fin.operatingExpenses)} · кэш ${formatCompactMoney(fin.cashBalance)}`
    : 'Финансовый снимок не загружен'

  const docsLine =
    card.openDocumentRequests.length > 0
      ? `Открытых запросов: ${card.openDocumentRequests.length}`
      : `Документов в заявке: ${card.application.documents.length}`

  const checksLine =
    cs.failed > 0
      ? `${cs.passed} пройдено · ${cs.warnings} замечаний · ${cs.failed} ошибок`
      : cs.warnings > 0
        ? `${cs.passed} пройдено · ${cs.warnings} замечаний`
        : `${cs.passed} пройдено · замечаний нет`

  const rows = [
    { label: 'Цель', value: c.purpose || '—' },
    { label: 'Финансы', value: finLine },
    { label: 'Документы', value: docsLine },
    { label: 'Автопроверки', value: checksLine },
    {
      label: 'Workflow',
      value: card.workflow
        ? `${card.workflow.workflowType} · ${card.workflow.status} · ${card.workflow.currentStep || '—'}`
        : '—',
    },
    { label: 'Следующий шаг', value: c.nextStep },
  ]

  const assignM = useMutation({
    mutationFn: () => assignAnalystApplication(applicationId),
    onSuccess: () => {
      setFlash('Заявка взята в работу')
      void qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
      void qc.invalidateQueries({ queryKey: ['analyst', 'queue'] })
    },
    onError: () => setFlash('Не удалось назначить заявку'),
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.75 }}>
          Сводка заявки
        </Typography>
        {flash && (
          <Alert
            severity={flash.startsWith('Не') ? 'error' : 'success'}
            sx={{ mb: 1.5 }}
            onClose={() => setFlash(null)}
          >
            {flash}
          </Alert>
        )}
        <Stack spacing={1.5}>
          {rows.map((r) => (
            <Stack
              key={r.label}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.35, sm: 2 }}
              sx={{
                py: 1.1,
                borderBottom: '1px solid rgba(11,31,53,0.06)',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Typography
                sx={{ width: { sm: 140 }, flexShrink: 0, fontSize: 13, color: '#8A96A3', fontWeight: 600 }}
              >
                {r.label}
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#0B1F35', fontWeight: 600 }}>{r.value}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          Контекстная панель
        </Typography>
        <Stack spacing={1}>
          {canAssign ? (
            <Button
              fullWidth
              variant="contained"
              sx={primaryBtn}
              disabled={assignM.isPending}
              onClick={() => assignM.mutate()}
            >
              {assignM.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                'Взять в работу'
              )}
            </Button>
          ) : (
            <Button fullWidth variant="contained" sx={primaryBtn} disabled>
              {assignedToMe ? 'Назначена вам' : `Аналитик: ${c.analyst}`}
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/documents`)}
            disabled={!card.allowedActions.includes('REQUEST_DOCS')}
          >
            Запросить документы
          </Button>
          <Button
            fullWidth
            variant="contained"
            sx={primaryBtn}
            onClick={() => navigate(`${base}/checks`)}
          >
            Продолжить проверку
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/decision`)}
          >
            Перейти к решению
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/history`)}
          >
            История заявки
          </Button>
        </Stack>
        {docsBlocked && (
          <Typography sx={{ mt: 1.5, fontSize: 12.5, color: '#C45A12', lineHeight: 1.45 }}>
            Есть незакрытые замечания по документам или проверкам — учтите перед одобрением.
          </Typography>
        )}
        {card.application.aiSummary && (
          <Typography sx={{ mt: 1.5, fontSize: 12.5, color: '#5A6B7D', lineHeight: 1.45 }}>
            {card.application.aiSummary}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
