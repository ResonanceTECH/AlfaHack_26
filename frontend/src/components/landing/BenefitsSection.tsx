import { Box, Container, Stack, Typography } from '@mui/material'
import { landingAssets } from '@/assets/landing'
import { LandingIllustration } from './SvgPlaceholder'

const BENEFITS = [
  {
    title: 'От цели — к продукту',
    description:
      'Укажите закупку, точку, оборудование или кассовый разрыв — кабинет подберёт подходящий кредит',
    asset: landingAssets.benefitGoal,
    file: 'benefit-goal.svg',
  },
  {
    title: 'Умный подбор, не каталог',
    description:
      'Сравнение ставок, сроков и платежей по продуктам Альфа-Банка с рекомендацией под ваш профиль',
    asset: landingAssets.benefitMatch,
    file: 'benefit-match.svg',
  },
  {
    title: 'Выписка и прогноз',
    description:
      'Загрузите движение средств — увидите cash flow, нагрузку по кредиту и окупаемость цели',
    asset: landingAssets.benefitStatement,
    file: 'benefit-statement.svg',
  },
  {
    title: 'Готовность к заявке',
    description:
      'Чеклист документов, индекс готовности и передача заявки кредитному менеджеру в один клик',
    asset: landingAssets.benefitReady,
    file: 'benefit-ready.svg',
  },
]

export function BenefitsSection() {
  return (
    <Box sx={{ bgcolor: '#fff', pt: { xs: 6, md: 9 }, pb: { xs: 4, md: 6 } }}>
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
            maxWidth: 640,
          }}
        >
          Кабинет, который ведёт к кредиту
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}
        >
          {BENEFITS.map((item) => (
            <Box
              key={item.title}
              sx={{
                bgcolor: '#E8F3FA',
                borderRadius: 4,
                p: { xs: 2.5, md: 3 },
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 2,
                alignItems: 'center',
                minHeight: { xs: 140, md: 168 },
              }}
            >
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 700,
                    fontSize: { xs: 18, md: 22 },
                    letterSpacing: '-0.02em',
                    color: '#0B1F35',
                    lineHeight: 1.25,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.45 }}>
                  {item.description}
                </Typography>
              </Stack>

              <Box sx={{ width: { xs: 72, md: 96 }, height: { xs: 72, md: 96 }, flexShrink: 0 }}>
                <LandingIllustration src={item.asset} label={item.file} tone="light" />
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
