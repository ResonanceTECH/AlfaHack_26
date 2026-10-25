import { Box, Stack, Typography } from '@mui/material'
import { RISK_SUMMARY } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

export function AnalystCaseRisksPage() {
  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        {[
          { label: 'Категория риска', value: RISK_SUMMARY.category },
          { label: 'PD proxy', value: RISK_SUMMARY.pdProxy },
          { label: 'Модель', value: RISK_SUMMARY.model },
        ].map((k) => (
          <Box key={k.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8A96A3' }}>{k.label}</Typography>
            <Typography
              sx={{
                mt: 0.75,
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 24,
                color: '#0B1F35',
              }}
            >
              {k.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.5 }}>
          Драйверы скоринга
        </Typography>
        <Stack spacing={1.25}>
          {RISK_SUMMARY.drivers.map((d) => (
            <Stack
              key={d.label}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                py: 1.25,
                px: 1.5,
                borderRadius: 2,
                bgcolor: '#F7F8FA',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  bgcolor: d.impact === '+' ? 'rgba(46,125,50,0.12)' : 'rgba(239,49,36,0.1)',
                  color: d.impact === '+' ? '#2E7D32' : '#EF3124',
                }}
              >
                {d.impact}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{d.label}</Typography>
                <Typography sx={{ fontSize: 13, color: '#7A8795' }}>{d.detail}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
