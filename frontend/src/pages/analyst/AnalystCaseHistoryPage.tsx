import { Box, Stack, Typography } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { formatHistoryAt } from '@/features/analyst/map'
import { statusPill, tileSx } from '@/features/analyst/styles'

export function AnalystCaseHistoryPage() {
  const { card } = useOutletContext<AnalystCaseOutlet>()
  const events = [
    ...card.statusHistory.map((h) => ({
      at: formatHistoryAt(h.at),
      actor: h.by || 'System',
      badge: h.status,
      text: `Статус → ${h.status}`,
    })),
    ...card.application.comments.map((c) => ({
      at: formatHistoryAt(c.createdAt),
      actor: c.authorName || '—',
      badge: 'COMMENT',
      text: c.text,
    })),
    ...card.decisions.map((d) => {
      const row = d as Record<string, unknown>
      return {
        at: formatHistoryAt(String(row.createdAt ?? row.created_at ?? '')),
        actor: 'Decision',
        badge: String(row.decisionType ?? row.decision_type ?? 'DECISION'),
        text: String(row.explanation ?? ''),
      }
    }),
  ]

  return (
    <Box sx={tileSx}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 2.5 }}>
        История заявки и аудит
      </Typography>

      {events.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: '#8A96A3' }}>Событий пока нет</Typography>
      ) : (
        <Box sx={{ position: 'relative', pl: { xs: 2.5, sm: 0 } }}>
          {events.map((e, i) => {
            const last = i === events.length - 1
            return (
              <Stack
                key={`${e.at}-${e.badge}-${i}`}
                direction="row"
                spacing={{ xs: 1.5, sm: 2 }}
                alignItems="flex-start"
                sx={{ position: 'relative', pb: last ? 0 : 2.25 }}
              >
                <Box
                  sx={{
                    width: { xs: 14, sm: 88 },
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'center', sm: 'flex-start' },
                    gap: { sm: 1.25 },
                    pt: 0.35,
                  }}
                >
                  <Typography
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      width: 64,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A96A3',
                      textAlign: 'right',
                      lineHeight: 1.3,
                      pt: 0.15,
                    }}
                  >
                    {e.at}
                  </Typography>
                  <Box sx={{ position: 'relative', width: 14, display: 'flex', justifyContent: 'center' }}>
                    {!last && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 10,
                          bottom: -28,
                          width: 2,
                          bgcolor: 'rgba(239,49,36,0.2)',
                        }}
                      />
                    )}
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: '#EF3124',
                        mt: 0.35,
                        zIndex: 1,
                        boxShadow: '0 0 0 3px rgba(239,49,36,0.15)',
                      }}
                    />
                  </Box>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, pt: 0.1 }}>
                  <Typography
                    sx={{
                      display: { xs: 'block', sm: 'none' },
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#8A96A3',
                      mb: 0.35,
                    }}
                  >
                    {e.at}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0.5, sm: 1.5 }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Typography
                      sx={{
                        width: { sm: 130 },
                        flexShrink: 0,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0B1F35',
                      }}
                    >
                      {e.actor}
                    </Typography>
                    <Box
                      sx={{
                        ...statusPill,
                        bgcolor: 'rgba(239,49,36,0.08)',
                        color: '#EF3124',
                      }}
                    >
                      {e.badge}
                    </Box>
                    <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.4 }}>
                      {e.text}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            )
          })}
        </Box>
      )}

      <Typography sx={{ mt: 2.5, fontSize: 12, color: '#8A96A3', lineHeight: 1.45 }}>
        Журнал только для чтения
      </Typography>
    </Box>
  )
}
