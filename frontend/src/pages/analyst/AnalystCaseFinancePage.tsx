import { Box, Typography } from '@mui/material'
import { FIN_KPIS } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

const MONTHS = [
  { m: 'Май', rev: 4.2, exp: 3.7 },
  { m: 'Июн', rev: 4.5, exp: 3.9 },
  { m: 'Июл', rev: 4.1, exp: 3.8 },
  { m: 'Авг', rev: 4.9, exp: 4.2 },
  { m: 'Сен', rev: 4.6, exp: 4.0 },
  { m: 'Окт', rev: 4.8, exp: 4.1 },
]

export function AnalystCaseFinancePage() {
  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        {FIN_KPIS.map((k) => (
          <Box key={k.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8A96A3' }}>{k.label}</Typography>
            <Typography
              sx={{
                mt: 0.75,
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 22,
                color: '#0B1F35',
                letterSpacing: '-0.02em',
              }}
            >
              {k.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 2 }}>
          Динамика выручки и расходов (млн ₽)
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 1.25,
            alignItems: 'end',
            minHeight: 160,
          }}
        >
          {MONTHS.map((x) => (
            <Box key={x.m} sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'flex-end', height: 120 }}>
                <Box
                  sx={{
                    width: 14,
                    height: `${(x.rev / 5) * 100}%`,
                    borderRadius: 1,
                    bgcolor: '#EF3124',
                  }}
                />
                <Box
                  sx={{
                    width: 14,
                    height: `${(x.exp / 5) * 100}%`,
                    borderRadius: 1,
                    bgcolor: 'rgba(11,31,53,0.18)',
                  }}
                />
              </Box>
              <Typography sx={{ mt: 1, fontSize: 11, fontWeight: 600, color: '#8A96A3' }}>{x.m}</Typography>
            </Box>
          ))}
        </Box>
        <Typography sx={{ mt: 2, fontSize: 12, color: '#8A96A3' }}>
          Красный — выручка · серый — расходы · источник: банковская выписка 6 мес.
        </Typography>
      </Box>
    </Box>
  )
}
