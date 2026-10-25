import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { landingAssets } from '@/assets/landing'

const STATS = [
  { value: 'От 14%*', label: 'Ставка со скидкой' },
  { value: 'До 10 лет', label: 'Срок' },
  { value: 'До 150 млн ₽', label: 'Сумма' },
  { value: '0 ₽', label: 'Комиссия за выдачу' },
]

export function HeroSection() {
  return (
    <Box
      sx={{
        bgcolor: '#1A1A1A',
        color: '#fff',
        pt: { xs: 4, md: 6 },
        pb: { xs: 5, md: 7 },
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 3, md: 4 },
            alignItems: 'center',
            mb: { xs: 4, md: 5 },
          }}
        >
          <Stack spacing={2.5} sx={{ maxWidth: 540 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 32, sm: 42, md: 48 },
                lineHeight: 1.1,
                letterSpacing: '-0.035em',
              }}
            >
              Кредит на развитие малого бизнеса
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: { xs: 15, md: 17 },
                lineHeight: 1.5,
                maxWidth: 460,
              }}
            >
              Растите с Линией решения: подберите продукт под цель бизнеса, сравните
              условия и оформите заявку в одном кабинете
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                color="primary"
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 3.5,
                  py: 1.4,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Оформить заявку
              </Button>
              <Button
                href="#how"
                variant="outlined"
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1.4,
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.35)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                Как работает
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'flex',
              justifyContent: { xs: 'center', md: 'flex-end' },
              alignItems: 'center',
            }}
          >
            <Box
              component="img"
              src={landingAssets.hero}
              alt="Финансовый дашборд с портфелем и ростом"
              sx={{
                width: '100%',
                maxWidth: { xs: 420, md: 520 },
                height: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 28px 48px rgba(0,0,0,0.55))',
              }}
            />
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {STATS.map(({ value, label }) => (
            <Box
              key={label}
              sx={{
                bgcolor: '#2A2A2A',
                borderRadius: 3,
                p: { xs: 2, md: 2.5 },
                minHeight: { xs: 96, md: 112 },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: 22, md: 28 },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  mb: 0.5,
                }}
              >
                {value}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
