import { Box, Button, Stack, Typography } from '@mui/material'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { useNavigate } from 'react-router-dom'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2.25, md: 2.75 },
} as const

const SCENARIOS = [
  {
    to: '/app/calculator',
    title: 'Кредитный калькулятор',
    body: 'Сумма, срок, ставка → платёж, переплата и график. Параметры можно унести в заявку.',
    Icon: CalculateRoundedIcon,
    accent: '#EF3124',
  },
  {
    to: '/app/forecast',
    title: 'Прогноз денежных средств',
    body: 'Остаток по месяцам с кредитом и без — одна фраза вывода и таблица для доверия.',
    Icon: ShowChartRoundedIcon,
    accent: '#C45A12',
  },
  {
    to: '/app/roi',
    title: 'Окупаемость проекта',
    body: 'Инвестиции, NPV и срок окупаемости с допущениями и чувствительностью.',
    Icon: TrendingUpRoundedIcon,
    accent: '#1B8A5A',
  },
]

export function ScenarioLabPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 3 }}>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: 26, md: 28 },
          letterSpacing: '-0.03em',
          color: '#0B1F35',
          mb: 0.75,
        }}
      >
        Сценарии и подбор
      </Typography>
      <Typography
        sx={{
          color: '#5A6B7D',
          fontSize: 15,
          mb: 2.5,
          maxWidth: 560,
          lineHeight: 1.55,
        }}
      >
        Проверьте кредит до заявки: хватит ли на платежи, не уйдёт ли счёт в минус и окупится ли
        вложение.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1.75,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {SCENARIOS.map((s) => (
          <Box
            key={s.to}
            component="button"
            type="button"
            onClick={() => navigate(s.to)}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              ...tileSx,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              '&:hover': {
                borderColor: 'rgba(239,49,36,0.35)',
                boxShadow: '0 4px 18px rgba(11,31,53,0.08)',
              },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: `${s.accent}14`,
                color: s.accent,
                display: 'grid',
                placeItems: 'center',
                mb: 1.75,
              }}
            >
              <s.Icon sx={{ fontSize: 24 }} />
            </Box>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 17,
                color: '#0B1F35',
                mb: 0.75,
                letterSpacing: '-0.02em',
              }}
            >
              {s.title}
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#7A8795', lineHeight: 1.45, flex: 1, mb: 2 }}>
              {s.body}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#EF3124' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>Открыть</Typography>
              <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
            </Stack>
          </Box>
        ))}
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate('/app/recommendations')}
        sx={{
          mt: 2.5,
          borderRadius: 2,
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        }}
      >
        К подбору продуктов
      </Button>
    </Box>
  )
}
