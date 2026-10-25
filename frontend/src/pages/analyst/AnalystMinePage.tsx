import { Box, Button, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { DEMO_CASES } from '@/features/analyst/demoData'
import { outlineBtn, tileSx } from '@/features/analyst/styles'
import { StatusChip } from '@/components/analyst/AnalystCaseShell'

export function AnalystMinePage() {
  const navigate = useNavigate()
  const rows = DEMO_CASES.filter((c) => c.assignedToMe)

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
        Назначенные вам · {rows.length} активных
      </Typography>

      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        {rows.map((c, i) => (
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
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{c.id}</Typography>
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
      </Box>
    </Box>
  )
}
