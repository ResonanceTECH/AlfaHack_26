import { Box, Button, Container, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

const NAV = [
  { label: 'Возможности', href: '#features' },
  { label: 'Продукты', href: '#products' },
  { label: 'Как это работает', href: '#how' },
]

export function LandingHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        bgcolor: 'rgba(26,26,26,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={{ xs: 2, md: 4 }} sx={{ minWidth: 0 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{ textDecoration: 'none', flexShrink: 0, '&:hover': { opacity: 0.85 } }}
            >
              <Typography
                sx={{
                  color: '#EF3124',
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 22,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                }}
              >
                Alfa Credit
              </Typography>
              <Box sx={{ width: 36, height: 3, bgcolor: '#EF3124', borderRadius: 1, mt: 0.35 }} />
            </Box>

            <Stack
              direction="row"
              spacing={2.5}
              sx={{ display: { xs: 'none', md: 'flex' }, overflow: 'hidden' }}
            >
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  underline="none"
                  sx={{
                    color: 'rgba(255,255,255,0.78)',
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    '&:hover': { color: '#fff' },
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
            <Button
              href="#apply"
              variant="contained"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                bgcolor: '#3A3A3A',
                color: '#fff',
                borderRadius: 2,
                px: 2,
                py: 1,
                fontSize: 14,
                '&:hover': { bgcolor: '#4A4A4A' },
              }}
            >
              Открыть кабинет
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              color="primary"
              sx={{ borderRadius: 2, px: 2.5, py: 1, fontSize: 14 }}
            >
              Войти
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
