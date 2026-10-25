import { Box, Container, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { AlfaLogo } from './AlfaLogo'

const COLUMNS = [
  {
    title: 'Продукт',
    links: [{ label: 'Подбор', to: '/login' }],
  },
  {
    title: 'Кабинет',
    links: [{ label: 'Заявки', to: '/app/applications' }],
  },
  {
    title: 'Банк',
    links: [{ label: 'Очередь', to: '/app/analyst' }],
  },
  {
    title: 'Разработчикам',
    links: [{ label: 'Design System', to: '/design-system' }],
  },
]

export function LandingFooter() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#1A1A1A',
        color: 'rgba(255,255,255,0.65)',
        pt: { xs: 5, md: 6 },
        pb: 4,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr repeat(4, 1fr)' },
            gap: { xs: 3, md: 2 },
            mb: 4,
          }}
        >
          <Box>
            <AlfaLogo compact />
            <Typography sx={{ mt: 1.5, fontSize: 13, lineHeight: 1.45, maxWidth: 260 }}>
              Линия решения — кредитный кабинет для ИП и малого бизнеса
            </Typography>
          </Box>

          {COLUMNS.map((col) => (
            <Stack key={col.title} spacing={1.25}>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {col.title}
              </Typography>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  component={RouterLink}
                  to={link.to}
                  underline="hover"
                  sx={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, width: 'fit-content' }}
                >
                  {link.label}
                </Link>
              ))}
            </Stack>
          ))}
        </Box>

        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 3 }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, maxWidth: 720 }}>
            © {new Date().getFullYear()} Альфа‑Банк. Не является публичной офертой. Условия
            кредитования определяются банком индивидуально. *Ставка со скидкой при подключении
            сервисов банка.
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
