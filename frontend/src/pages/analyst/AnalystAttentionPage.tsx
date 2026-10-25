import { Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { ATTENTION_ITEMS } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

const tones = {
  danger: '#EF3124',
  ok: '#2E7D32',
  warn: '#E6A018',
} as const

export function AnalystAttentionPage() {
  const navigate = useNavigate()

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

      <Stack spacing={1.5}>
        {ATTENTION_ITEMS.map((item) => (
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
