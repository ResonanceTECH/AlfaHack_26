import { Box, Stack, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

const STEPS = ['Цель', 'Бюджет', 'Подбор продуктов', 'Сравнение', 'Заявка'] as const

export function SelectionStepper({ active }: { active: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.5, sm: 0 },
        overflowX: 'auto',
        mb: 2.5,
        pb: 0.5,
        px: { xs: 0.25, md: 1 },
      }}
    >
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4 | 5
        const done = n < active
        const current = n === active
        return (
          <Stack
            key={label}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ flex: { sm: 1 }, minWidth: 'max-content' }}
          >
            <Stack direction="row" alignItems="center" spacing={0.85}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12.5,
                  fontWeight: 800,
                  bgcolor: done ? '#1B8A5A' : current ? '#EF3124' : '#E8EBEE',
                  color: done || current ? '#fff' : '#9AA5B1',
                  flexShrink: 0,
                }}
              >
                {done ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : n}
              </Box>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: current ? 750 : 600,
                  color: current ? '#0B1F35' : done ? '#1B8A5A' : '#9AA5B1',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Typography>
            </Stack>
            {i < STEPS.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  mx: 1,
                  minWidth: 16,
                  borderRadius: 1,
                  bgcolor: done ? '#1B8A5A' : '#E8EBEE',
                  display: { xs: 'none', md: 'block' },
                }}
              />
            )}
          </Stack>
        )
      })}
    </Box>
  )
}
