import { Box, Stack, Typography } from '@mui/material'
import { HISTORY_EVENTS } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

export function AnalystCaseHistoryPage() {
  return (
    <Box sx={tileSx}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 2 }}>
        История заявки
      </Typography>
      <Stack spacing={0}>
        {HISTORY_EVENTS.map((e, i) => (
          <Stack
            key={`${e.at}-${i}`}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            sx={{
              py: 1.5,
              borderTop: i === 0 ? 'none' : '1px solid rgba(11,31,53,0.06)',
            }}
          >
            <Typography sx={{ width: { sm: 150 }, flexShrink: 0, fontSize: 12.5, color: '#8A96A3' }}>
              {e.at}
            </Typography>
            <Typography sx={{ width: { sm: 120 }, flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#0B1F35' }}>
              {e.actor}
            </Typography>
            <Typography sx={{ fontSize: 14, color: '#5A6B7D' }}>{e.text}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
