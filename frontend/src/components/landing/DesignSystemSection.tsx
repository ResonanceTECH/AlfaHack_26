import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

const GROUPS = [
  {
    title: 'Токены',
    items: ['Цвета', 'Типографика', 'Отступы', 'Сетка', 'Радиусы', 'Тени'],
  },
  {
    title: 'Базовые',
    items: ['Кнопки', 'Инпуты', 'PasswordField', 'Chips', 'Alerts', 'Icons'],
  },
  {
    title: 'Кабинет',
    items: ['PageHeader', 'StatBlock', 'EmptyState', 'Disclaimer', 'Nav', 'Stepper'],
  },
  {
    title: 'Продукт',
    items: [
      'CreditRecommendationCard',
      'PaymentScheduleTable',
      'LegalFormToggle',
      'AuthShell',
      'LinkExpiryTimer',
      'AlfaLogo',
    ],
  },
  {
    title: 'MUI-паттерны',
    items: ['Tabs', 'Accordion', 'Avatar', 'Badge', 'Checkbox', 'Switch', 'Table', 'Skeleton'],
  },
]

export function DesignSystemSection() {
  return (
    <Box
      id="design-system"
      sx={{
        bgcolor: '#0B1F35',
        color: '#fff',
        pt: { xs: 6, md: 8 },
        pb: { xs: 6, md: 8 },
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'flex-end' }}
          spacing={2}
          sx={{ mb: { xs: 3.5, md: 4.5 } }}
        >
          <Box sx={{ maxWidth: 560 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
                mb: 1.25,
              }}
            >
              Для разработчиков
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 28, md: 40 },
                letterSpacing: '-0.03em',
                lineHeight: 1.12,
                mb: 1.25,
              }}
            >
              Design System
            </Typography>
            <Typography sx={{ fontSize: { xs: 15, md: 16 }, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>
              Живой UI-kit «Линия решения»: токены, базовые контролы и продуктовые компоненты с
              копируемым кодом — как в репозитории.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/design-system"
            variant="contained"
            color="primary"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.35,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Открыть UI-kit
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {GROUPS.map((g) => (
            <Box
              key={g.title}
              component={RouterLink}
              to="/design-system"
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                p: 2,
                borderRadius: 2.5,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                minWidth: 0,
                transition: 'background 0.15s ease, border-color 0.15s ease',
                '&:hover': {
                  bgcolor: 'rgba(239,49,36,0.12)',
                  borderColor: 'rgba(239,49,36,0.35)',
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 750,
                  fontSize: 15,
                  mb: 1.25,
                  letterSpacing: '-0.02em',
                }}
              >
                {g.title}
              </Typography>
              <Stack spacing={0.55}>
                {g.items.map((item) => (
                  <Typography
                    key={item}
                    sx={{
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.35,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
