import { Box, Container, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export function LandingFooter() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#1A1A1A',
        color: 'rgba(255,255,255,0.65)',
        py: 4,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box>
            <Typography
              sx={{
                color: '#EF3124',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: '-0.02em',
                mb: 0.5,
              }}
            >
              Alfa Credit
            </Typography>
            <Typography sx={{ fontSize: 13, maxWidth: 420, lineHeight: 1.45 }}>
              Демо кредитного кабинета для ИП и МСБ — хакатон AlfaHack26, кейс подбора и оформления
              кредитов.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2.5}>
            <Link component={RouterLink} to="/login" underline="hover" color="inherit" sx={{ fontSize: 14 }}>
              Войти
            </Link>
            <Link
              component={RouterLink}
              to="/register"
              underline="hover"
              color="inherit"
              sx={{ fontSize: 14 }}
            >
              Регистрация
            </Link>
            <Link href="/docs" underline="hover" color="inherit" sx={{ fontSize: 14 }}>
              API
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
