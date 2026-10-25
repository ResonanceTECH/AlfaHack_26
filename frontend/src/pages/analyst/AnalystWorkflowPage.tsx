import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchAnalystQueue } from '@/api/analyst'
import { tileSx } from '@/features/analyst/styles'

const STAGE_MAP: { key: string; label: string; statuses: string[]; sla: string }[] = [
  { key: 'intake', label: 'Intake', statuses: ['SUBMITTED', 'VALIDATING'], sla: '4ч' },
  { key: 'docs', label: 'Документы', statuses: ['DOCS_REQUESTED'], sla: '24ч' },
  { key: 'checks', label: 'Проверки', statuses: ['IN_REVIEW'], sla: '8ч' },
  { key: 'risk', label: 'Риск', statuses: ['RISK_REVIEW'], sla: '12ч' },
  {
    key: 'decision',
    label: 'Решение',
    statuses: ['APPROVED', 'COUNTEROFFERED', 'REJECTED'],
    sla: '6ч',
  },
  { key: 'issue', label: 'Выдача', statuses: ['ISSUED', 'OFFER_ACCEPTED'], sla: '48ч' },
]

export function AnalystWorkflowPage() {
  const queueQ = useQuery({
    queryKey: ['analyst', 'queue', 'workflow'],
    queryFn: () => fetchAnalystQueue({ limit: 100, includeClosed: true }),
  })

  const counts = queueQ.data?.countsByStatus ?? {}
  const stages = STAGE_MAP.map((s) => ({
    ...s,
    count: s.statuses.reduce((sum, st) => sum + (counts[st] ?? 0), 0),
  }))
  const total = stages.reduce((s, x) => s + x.count, 0)
  const docs = counts.DOCS_REQUESTED ?? 0
  const inReview = counts.IN_REVIEW ?? 0

  return (
    <Box>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: 22, md: 26 },
          color: '#0B1F35',
          letterSpacing: '-0.02em',
          mb: 0.5,
        }}
      >
        Рабочий процесс и SLA
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', mb: 2.5 }}>
        Конвейер рассмотрения · {queueQ.isLoading ? '…' : total} заявок на стадиях (countsByStatus)
      </Typography>

      {queueQ.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={28} sx={{ color: '#EF3124' }} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
              gap: 1.5,
              mb: 2.5,
            }}
          >
            {stages.map((s) => (
              <Box key={s.key} sx={tileSx}>
                <Typography
                  sx={{ fontSize: 12, fontWeight: 700, color: '#8A96A3', letterSpacing: '0.04em' }}
                >
                  {s.label.toUpperCase()}
                </Typography>
                <Typography
                  sx={{
                    mt: 1,
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 28,
                    color: '#0B1F35',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.count}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: 13, color: '#7A8795' }}>
                  целевой SLA · {s.sla}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={tileSx}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0B1F35', mb: 1.5 }}>
              Сводка по статусам
            </Typography>
            <Stack spacing={1.25}>
              {[
                { label: 'Ожидают документы', value: String(docs), color: '#EF3124' },
                { label: 'На проверке', value: String(inReview), color: '#E6A018' },
                { label: 'Всего в выборке', value: String(queueQ.data?.total ?? 0), color: '#2E7D32' },
              ].map((r) => (
                <Stack
                  key={r.label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    py: 1,
                    px: 1.5,
                    borderRadius: 2,
                    bgcolor: '#F7F8FA',
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0B1F35' }}>
                    {r.label}
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: r.color }}>
                    {r.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Box>
  )
}
