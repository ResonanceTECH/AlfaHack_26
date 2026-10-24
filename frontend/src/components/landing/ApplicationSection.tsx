import { Box, Button, Container, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export function ApplicationSection() {
  return (
    <Box id="apply" sx={{ bgcolor: '#fff', pt: { xs: 4, md: 5 }, pb: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            bgcolor: '#F8E8E6',
            borderRadius: 4,
            px: { xs: 3, md: 5 },
            py: { xs: 3.5, md: 4 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2.5,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 22, md: 28 },
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              color: '#0B1F35',
              maxWidth: 480,
            }}
          >
            Готовы подобрать кредит для бизнеса?
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            color="primary"
            size="large"
            sx={{
              borderRadius: 2.5,
              px: 3.5,
              py: 1.5,
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Войти в кабинет
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
