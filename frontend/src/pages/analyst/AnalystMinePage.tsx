import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAnalystQueue } from '@/api/analyst'
import { StatusChip } from '@/components/analyst/AnalystCaseShell'
import { queueItemToCase } from '@/features/analyst/map'
import { outlineBtn, tileSx } from '@/features/analyst/styles'
import { useAuth } from '@/contexts/AuthContext'

export function AnalystMinePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const queueQ = useQuery({
    queryKey: ['analyst', 'queue', 'mine'],
    queryFn: () => fetchAnalystQueue({ assignedToMe: true, limit: 50 }),
  })

  const rows = useMemo(
    () => (queueQ.data?.items ?? []).map((i) => queueItemToCase(i, { myUserId: user?.id })),
    [queueQ.data, user?.id],
  )

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
        Мои заявки
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', mb: 2.5 }}>
        Назначенные вам · {queueQ.data?.total ?? '…'} активных
      </Typography>

      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        {queueQ.isLoading && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#EF3124' }} />
          </Box>
        )}
        {queueQ.isError && (
          <Typography sx={{ p: 3, color: '#EF3124', fontSize: 14 }}>
            Не удалось загрузить заявки
          </Typography>
        )}
        {!queueQ.isLoading &&
          !queueQ.isError &&
          rows.map((c, i) => (
            <Stack
              key={c.id}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={1.5}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.85,
                borderTop: i === 0 ? 'none' : '1px solid rgba(11,31,53,0.06)',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>
                    {c.number || c.id}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: '#0B1F35' }}>{c.company}</Typography>
                  <StatusChip status={c.status} />
                </Stack>
                <Typography sx={{ mt: 0.5, fontSize: 13, color: '#7A8795' }}>{c.nextStep}</Typography>
              </Box>
              <Button
                variant="outlined"
                sx={{ ...outlineBtn, flexShrink: 0 }}
                onClick={() => navigate(`/app/analyst/cases/${c.id}`)}
              >
                Открыть
              </Button>
            </Stack>
          ))}
        {!queueQ.isLoading && !queueQ.isError && rows.length === 0 && (
          <Typography sx={{ p: 3, color: '#7A8795', fontSize: 14 }}>Нет назначенных заявок</Typography>
        )}
      </Box>
    </Box>
  )
}
