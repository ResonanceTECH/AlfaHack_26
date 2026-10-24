import { Box, Container, Typography } from '@mui/material'

const BENEFITS = [
  {
    num: '01',
    title: 'Быстрый подбор',
    description:
      'Цель и бюджет — и сразу shortlist продуктов с платежом, ставкой и сроком под ваш профиль',
  },
  {
    num: '02',
    title: 'Прозрачные причины',
    description:
      'Понятно, почему рекомендован продукт: выручка, нагрузка, залог и готовность документов',
  },
  {
    num: '03',
    title: 'Единый конвейер',
    description:
      'От сравнения до заявки менеджеру в одном кабинете — без переключения между сервисами',
  },
  {
    num: '04',
    title: 'Готовность к заявке',
    description:
      'Чеклист документов, индекс готовности и передача менеджеру — без лишних шагов',
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
          Почему предприниматели выбирают сервис
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
              key={item.num}
              sx={{
                bgcolor: '#fff',
                borderRadius: 3.5,
                p: { xs: 2.5, md: 3 },
                border: '1px solid rgba(11,31,53,0.08)',
                boxShadow: '0 1px 2px rgba(11,31,53,0.03)',
                minHeight: { xs: 140, md: 156 },
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#EF3124',
                  letterSpacing: '0.04em',
                  mb: 1.25,
                }}
              >
                {item.num}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: { xs: 18, md: 20 },
                  letterSpacing: '-0.02em',
                  color: '#0B1F35',
                  lineHeight: 1.25,
                  mb: 1,
                }}
              >
                {item.title}
              </Typography>
              <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.5 }}>
                {item.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
