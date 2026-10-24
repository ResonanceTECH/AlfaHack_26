import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Box, Button, Container, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'

type Product = {
  title: string
  rate: string
  terms: string
  Icon: SvgIconComponent
}

const PRODUCTS: Product[] = [
  {
    title: 'Оборотный кредит',
    rate: 'от 16,9%*',
    terms: 'до 5 млн ₽ · до 36 мес.',
    Icon: AccountBalanceWalletOutlinedIcon,
  },
  {
    title: 'Кредитная линия',
    rate: 'от 17,5%*',
    terms: 'до 30 млн ₽ · до 60 мес.',
    Icon: LockOutlinedIcon,
  },
  {
    title: 'Кредит на развитие',
    rate: 'от 14%*',
    terms: 'до 150 млн ₽ · до 10 лет',
    Icon: DescriptionOutlinedIcon,
  },
]

export function CreditTypesSection() {
  return (
    <Box id="products" sx={{ bgcolor: '#fff', pt: { xs: 6, md: 8 }, pb: { xs: 6, md: 8 } }}>
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
            mb: { xs: 3, md: 4 },
          }}
        >
          Виды финансирования
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {PRODUCTS.map(({ title, rate, terms, Icon }) => (
            <Box
              key={title}
              sx={{
                bgcolor: '#fff',
                borderRadius: 3.5,
                p: { xs: 2.5, md: 3 },
                border: '1px solid rgba(11,31,53,0.08)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 240,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'rgba(239,49,36,0.08)',
                  color: '#EF3124',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 2,
                }}
              >
                <Icon sx={{ fontSize: 24 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#0B1F35',
                  letterSpacing: '-0.02em',
                  mb: 1.5,
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 22,
                  color: '#EF3124',
                  letterSpacing: '-0.02em',
                  mb: 0.5,
                }}
              >
                {rate}
              </Typography>
              <Typography sx={{ color: '#5A6B7D', fontSize: 14, mb: 2.5, flex: 1 }}>{terms}</Typography>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                fullWidth
                sx={{
                  borderRadius: 2,
                  borderColor: 'rgba(11,31,53,0.2)',
                  color: '#0B1F35',
                  fontWeight: 600,
                  py: 1.1,
                  '&:hover': { borderColor: '#0B1F35', bgcolor: 'rgba(11,31,53,0.03)' },
                }}
              >
                Подробнее
              </Button>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
