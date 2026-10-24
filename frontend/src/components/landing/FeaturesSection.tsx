import { Box, Container, Stack, Typography } from '@mui/material'
import { landingAssets } from '@/assets/landing'
import { LandingIllustration } from './SvgPlaceholder'

const FEATURES = [
  {
    title: 'AI-консультант',
    description: 'Отвечает по продуктам, документам и сценариям — без ожидания менеджера',
    asset: landingAssets.featureAi,
    file: 'feature-ai.svg',
  },
  {
    title: 'Прогноз cash flow',
    description: 'Сезонный baseline по выписке: увидите, потянете ли платёж до выдачи',
    asset: landingAssets.featureForecast,
    file: 'feature-forecast.svg',
  },
  {
    title: 'Scenario Lab',
    description: 'Смоделируйте рост выручки, задержку оплаты или доп. точку — и влияние на кредит',
    asset: landingAssets.featureScenario,
    file: 'feature-scenario.svg',
  },
  {
    title: 'Окупаемость и ROI',
    description: 'Свяжите цель кредита с возвратом инвестиций и графиком платежей',
    asset: landingAssets.featureRoi,
    file: 'feature-roi.svg',
  },
]

export function FeaturesSection() {
  return (
    <Box id="features" sx={{ bgcolor: '#F7F8FA', pt: { xs: 6, md: 8 }, pb: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1.5} sx={{ mb: { xs: 3, md: 4 }, maxWidth: 640 }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 28, md: 40 },
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              color: '#0B1F35',
            }}
          >
            Инструменты кабинета
          </Typography>
          <Typography sx={{ color: '#5A6B7D', fontSize: 16, lineHeight: 1.5 }}>
            Не просто форма заявки — аналитика, которую предприниматель использует до и после кредита
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {FEATURES.map((item) => (
            <Box
              key={item.title}
              sx={{
                bgcolor: '#fff',
                borderRadius: 4,
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 220,
                border: '1px solid rgba(11,31,53,0.06)',
              }}
            >
              <Box sx={{ width: 64, height: 64, mb: 2 }}>
                <LandingIllustration src={item.asset} label={item.file} tone="light" />
              </Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#0B1F35',
                  mb: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {item.title}
              </Typography>
              <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.45 }}>
                {item.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
