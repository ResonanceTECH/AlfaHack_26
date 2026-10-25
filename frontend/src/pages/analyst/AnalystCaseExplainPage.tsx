import { Box, Stack, Typography } from '@mui/material'
import { tileSx } from '@/features/analyst/styles'

const FACTORS = [
  { title: 'Положительный NCF', weight: 0.28, direction: 'за' },
  { title: 'DSCR выше порога политики', weight: 0.22, direction: 'за' },
  { title: 'Срок бизнеса > 5 лет', weight: 0.18, direction: 'за' },
  { title: 'Кассовые разрывы в августе', weight: 0.16, direction: 'против' },
  { title: 'Запрошенный платёж / NCF', weight: 0.1, direction: 'за' },
  { title: 'Неполный комплект документов', weight: 0.06, direction: 'против' },
]

export function AnalystCaseExplainPage() {
  return (
    <Box>
      <Box sx={{ ...tileSx, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1 }}>
          Объяснимость решения модели
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.55, maxWidth: 720 }}>
          Предварительная рекомендация: <b>одобрить с условием</b> закрытия замечания по справке об
          оборотах. Ниже — вклад ключевых факторов в рекомендацию модели.
        </Typography>
      </Box>

      <Box sx={tileSx}>
        <Stack spacing={1.5}>
          {FACTORS.map((f) => (
            <Box key={f.title}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                  {f.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: f.direction === 'за' ? '#2E7D32' : '#EF3124',
                  }}
                >
                  {f.direction} · {(f.weight * 100).toFixed(0)}%
                </Typography>
              </Stack>
              <Box sx={{ height: 8, borderRadius: 99, bgcolor: 'rgba(11,31,53,0.06)' }}>
                <Box
                  sx={{
                    width: `${f.weight * 100}%`,
                    height: '100%',
                    borderRadius: 99,
                    bgcolor: f.direction === 'за' ? '#2E7D32' : '#EF3124',
                  }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
