import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'
import { CabinetPreview } from './CabinetPreview'

const STATS: { value: string; label: string; Icon: SvgIconComponent }[] = [
  { value: 'AI', label: 'Подбор под цель бизнеса', Icon: PsychologyOutlinedIcon },
  { value: '1 клик', label: 'Выписка и cash flow', Icon: AccountBalanceOutlinedIcon },
  { value: '4+', label: 'Продукта в сравнении', Icon: RecommendOutlinedIcon },
  { value: '24/7', label: 'Заявка менеджеру', Icon: SupportAgentOutlinedIcon },
]

export function HeroSection() {
  return (
    <Box
      sx={{
        bgcolor: '#1A1A1A',
        color: '#fff',
        pt: { xs: 5, md: 7 },
        pb: { xs: 6, md: 8 },
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
            gap: { xs: 4, md: 3 },
            alignItems: 'center',
            mb: { xs: 4, md: 5 },
          }}
        >
          <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 32, sm: 42, md: 50 },
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
              }}
            >
              Кредитный кабинет предпринимателя
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: { xs: 16, md: 18 },
                lineHeight: 1.45,
                maxWidth: 460,
              }}
            >
              От бизнес-цели до заявки менеджеру: подбор продукта, прогноз cash flow, Scenario Lab и
              оформление в одном месте
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                href="#apply"
                variant="contained"
                color="primary"
                size="large"
                sx={{
                  borderRadius: 2.5,
                  px: 3.5,
                  py: 1.5,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Открыть кабинет
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="large"
                sx={{
                  borderRadius: 2.5,
                  px: 3,
                  py: 1.5,
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.35)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                Демо-вход
              </Button>
            </Stack>
          </Stack>

          <CabinetPreview />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {STATS.map(({ value, label, Icon }) => (
            <Box
              key={label}
              sx={{
                bgcolor: '#2A2A2A',
                borderRadius: 3,
                p: { xs: 2, md: 2.5 },
                minHeight: { xs: 110, md: 124 },
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: 22, md: 28 },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  mb: 0.75,
                }}
              >
                {value}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, pr: 4 }}>
                {label}
              </Typography>
              <Box
                sx={{
                  position: 'absolute',
                  right: 14,
                  bottom: 14,
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  bgcolor: '#1F1F1F',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <Icon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
