import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAnalystQueue } from '@/api/analyst'
import { queueItemToCase } from '@/features/analyst/map'
import { tileSx } from '@/features/analyst/styles'

const tones = {
  danger: '#EF3124',
  ok: '#2E7D32',
  warn: '#E6A018',
} as const

export function AnalystAttentionPage() {
  const navigate = useNavigate()

  const queueQ = useQuery({
    queryKey: ['analyst', 'queue', 'attention'],
    queryFn: () => fetchAnalystQueue({ assignedToMe: true, limit: 50 }),
  })

  const items = useMemo(() => {
    const rows = (queueQ.data?.items ?? []).map((i) => queueItemToCase(i))
    const out: { id: string; title: string; detail: string; tone: keyof typeof tones; caseId: string }[] =
      []
    for (const c of rows) {
      if (c.status === 'DOCS_REQUESTED' || (c.slaUrgent && c.status !== 'APPROVED')) {
        out.push({
          id: `docs-${c.id}`,
          title: c.status === 'DOCS_REQUESTED' ? 'Ожидание документов' : 'Требует внимания',
          detail: `${c.number || c.id} · ${c.company} · ${c.nextStep}`,
          tone: c.status === 'DOCS_REQUESTED' ? 'warn' : 'danger',
          caseId: c.id,
        })
      }
      if (c.status === 'COUNTEROFFERED') {
        out.push({
          id: `co-${c.id}`,
          title: 'Контрпредложение',
          detail: `${c.number || c.id} · ожидает ответа клиента`,
          tone: 'danger',
          caseId: c.id,
        })
      }
      if (c.status === 'IN_REVIEW') {
        out.push({
          id: `rev-${c.id}`,
          title: 'В работе',
          detail: `${c.number || c.id} · ${c.company}`,
          tone: 'ok',
          caseId: c.id,
        })
      }
    }
    // de-dupe by case, keep strongest
    const byCase = new Map<string, (typeof out)[number]>()
    const rank = { danger: 3, warn: 2, ok: 1 }
    for (const item of out) {
      const prev = byCase.get(item.caseId)
      if (!prev || rank[item.tone] > rank[prev.tone]) byCase.set(item.caseId, item)
    }
    return Array.from(byCase.values()).slice(0, 20)
  }, [queueQ.data])

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
        Требуют внимания
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', mb: 2.5 }}>
        Приоритетные события по вашим заявкам
      </Typography>

      {queueQ.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={28} sx={{ color: '#EF3124' }} />
        </Box>
      )}

      {!queueQ.isLoading && items.length === 0 && (
        <Typography sx={{ color: '#7A8795', fontSize: 14 }}>Нет приоритетных событий</Typography>
      )}

      <Stack spacing={1.5}>
        {items.map((item) => (
          <Box
            key={item.id}
            onClick={() => navigate(`/app/analyst/cases/${item.caseId}`)}
            sx={{
              ...tileSx,
              py: 2,
              px: 2.25,
              cursor: 'pointer',
              display: 'flex',
              gap: 2,
              alignItems: 'stretch',
              position: 'relative',
              overflow: 'hidden',
              pl: 2.75,
              '&:hover': { borderColor: 'rgba(11,31,53,0.12)' },
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                bgcolor: tones[item.tone],
              },
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0B1F35' }}>
                {item.title}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: '#7A8795' }}>{item.detail}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
