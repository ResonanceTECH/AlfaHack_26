import { Box, Container, Typography } from '@mui/material'

const STEPS = [
  {
    n: 1,
    title: 'Цель и бюджет',
    description: 'Укажите задачу бизнеса, сумму и желаемый срок — кабинет зафиксирует рамки подбора',
  },
  {
    n: 2,
    title: 'Подбор и сравнение',
    description: 'Сравните продукты по ставке, платежу и условиям — получите рекомендацию с объяснением',
  },
  {
    n: 3,
    title: 'Заявка и решение',
    description: 'Соберите документы, отправьте менеджеру и следите за статусом в едином конвейере',
  },
]

export function FeaturesSection() {
  return (
    <Box id="how" sx={{ bgcolor: '#F7F8FA', pt: { xs: 6, md: 8 }, pb: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography
          component="h2"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 28, md: 40 },
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: '#0B1F35',
            mb: { xs: 4, md: 5 },
            textAlign: 'center',
          }}
        >
          Как это работает
        </Typography>

        {/* Timeline connectors (desktop) */}
        <Box
          sx={{
            position: 'relative',
            display: { xs: 'none', md: 'block' },
            maxWidth: 720,
            mx: 'auto',
            mb: 3,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 18,
              left: '16.66%',
              right: '16.66%',
              height: 2,
              bgcolor: 'rgba(239,49,36,0.25)',
            }}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              position: 'relative',
            }}
          >
            {STEPS.map((s) => (
              <Box key={s.n} sx={{ display: 'grid', placeItems: 'center' }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: '#EF3124',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    fontFamily: 'Manrope, sans-serif',
                    boxShadow: '0 0 0 6px rgba(239,49,36,0.12)',
                  }}
                >
                  {s.n}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: { xs: 3, md: 3 },
          }}
        >
          {STEPS.map((s) => (
            <Box key={s.n} sx={{ textAlign: 'center', px: { md: 2 } }}>
              <Box
                sx={{
                  display: { xs: 'grid', md: 'none' },
                  placeItems: 'center',
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: '#EF3124',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  {s.n}
                </Box>
              </Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: { xs: 18, md: 20 },
                  color: '#0B1F35',
                  letterSpacing: '-0.02em',
                  mb: 1,
                }}
              >
                {s.title}
              </Typography>
              <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.5, maxWidth: 280, mx: 'auto' }}>
                {s.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
