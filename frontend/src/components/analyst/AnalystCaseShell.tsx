import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  fetchAnalystCard,
  resolveAnalystApplicationId,
  type AnalystApplicationCard,
} from '@/api/analyst'
import { CASE_TABS, type AnalystCase } from '@/features/analyst/demoData'
import { clearLastAnalystCaseId, writeLastAnalystCaseId } from '@/features/analyst/lastCase'
import { cardToCase } from '@/features/analyst/map'
import { outlineBtn, primaryBtn, statusPill } from '@/features/analyst/styles'
import { formatMoney } from '@/utils/format'

function tabPath(caseId: string, key: string) {
  return key ? `/app/analyst/cases/${caseId}/${key}` : `/app/analyst/cases/${caseId}`
}

export type AnalystCaseOutlet = {
  caseData: AnalystCase
  card: AnalystApplicationCard
  applicationId: string
}

export function AnalystCaseShell() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const resolveQ = useQuery({
    queryKey: ['analyst', 'resolve', caseId],
    queryFn: () => resolveAnalystApplicationId(caseId),
    enabled: Boolean(caseId),
    retry: false,
  })

  const applicationId = resolveQ.data ?? ''

  const cardQ = useQuery({
    queryKey: ['analyst', 'card', applicationId],
    queryFn: () => fetchAnalystCard(applicationId),
    enabled: Boolean(applicationId),
    retry: false,
  })

  const resolvedId = cardQ.data?.application.id
  const rest = location.pathname.replace(`/app/analyst/cases/${caseId}`, '').replace(/^\//, '')
  const loadFailed = Boolean(
    caseId &&
      !resolveQ.isLoading &&
      !cardQ.isLoading &&
      (resolveQ.isError || (applicationId && cardQ.isError) || (resolveQ.isSuccess && cardQ.isSuccess && !cardQ.data)),
  )

  useEffect(() => {
    if (!caseId || !resolvedId || caseId === resolvedId) return
    const suffix = rest ? `/${rest}` : ''
    writeLastAnalystCaseId(resolvedId)
    navigate(`/app/analyst/cases/${resolvedId}${suffix}`, { replace: true })
  }, [caseId, resolvedId, rest, navigate])

  useEffect(() => {
    if (resolvedId) writeLastAnalystCaseId(resolvedId)
  }, [resolvedId])

  // битый demo-id / 404 → чистим last case и уходим в очередь без красного алерта
  useEffect(() => {
    if (!loadFailed) return
    clearLastAnalystCaseId()
    navigate('/app/analyst', { replace: true, state: { caseMissing: caseId } })
  }, [loadFailed, caseId, navigate])

  if (resolveQ.isLoading || (applicationId && cardQ.isLoading) || loadFailed) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: '#EF3124' }} />
      </Box>
    )
  }

  if (!cardQ.data) {
    return (
      <Alert
        severity="info"
        sx={{ borderRadius: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => navigate('/app/analyst')}>
            К очереди
          </Button>
        }
      >
        Заявка не найдена. Откройте актуальную из очереди.
      </Alert>
    )
  }

  const card = cardQ.data
  const c = cardToCase(card)
  const base = `/app/analyst/cases/${c.id}`
  const activeTab = rest.split('/')[0] ?? ''
  const titleId = c.number || c.id

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 20, md: 24 },
              color: '#0B1F35',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {titleId} · {c.company}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: '#7A8795' }}>
            ИНН {c.inn} · {c.product} · {formatMoney(c.amount)} · {c.termMonths} мес.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Box
              sx={{
                ...statusPill,
                bgcolor: 'rgba(242, 153, 74, 0.16)',
                color: '#B86B12',
              }}
            >
              {c.status}
            </Box>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color: c.slaUrgent ? '#EF3124' : '#5A6B7D',
              }}
            >
              {c.slaLabel}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#7A8795' }}>Аналитик: {c.analyst}</Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`${base}/documents`)}
            disabled={!card.allowedActions.includes('REQUEST_DOCS')}
          >
            Запросить
          </Button>
          <Button
            variant="contained"
            sx={primaryBtn}
            onClick={() => navigate(`${base}/decision`)}
          >
            К решению
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, md: 2.5 },
          overflowX: 'auto',
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          mb: 2.5,
          pb: 0,
        }}
      >
        {CASE_TABS.map((t) => {
          const selected = activeTab === t.key
          return (
            <Box
              key={t.key || 'overview'}
              component={RouterLink}
              to={tabPath(c.id, t.key)}
              sx={{
                flexShrink: 0,
                textDecoration: 'none',
                pb: 1.1,
                px: 0.25,
                fontSize: 13.5,
                fontWeight: selected ? 700 : 600,
                color: selected ? '#0B1F35' : '#7A8795',
                borderBottom: selected ? '2px solid #EF3124' : '2px solid transparent',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
            </Box>
          )
        })}
      </Box>

      <Outlet context={{ caseData: c, card, applicationId: c.id } satisfies AnalystCaseOutlet} />
    </Box>
  )
}

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        height: 24,
        borderRadius: 1.25,
        fontWeight: 700,
        fontSize: 11,
        bgcolor: 'rgba(242, 153, 74, 0.16)',
        color: '#B86B12',
        '& .MuiChip-label': { px: 1 },
      }}
    />
  )
}
