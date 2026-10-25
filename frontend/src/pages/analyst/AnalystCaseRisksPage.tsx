import { Box, Button, Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { RISK_SUMMARY } from '@/features/analyst/demoData'
import { primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'

const kpis = [
  {
    label: 'Категория риска',
    value: RISK_SUMMARY.categoryLabel,
    hint: RISK_SUMMARY.model,
    hintTone: 'ok' as const,
  },
  {
    label: 'Вероятность дефолта',
    value: RISK_SUMMARY.pdProxy,
    hint: 'оценка модели',
    hintTone: 'muted' as const,
  },
  {
    label: 'Потери при дефолте',
    value: RISK_SUMMARY.lgdProxy,
    hint: 'оценка модели',
    hintTone: 'muted' as const,
  },
  {
    label: 'Факторы',
    value: String(RISK_SUMMARY.factorsCount),
    hint: 'в модели',
    hintTone: 'muted' as const,
  },
  {
    label: 'Рекомендация',
    value: RISK_SUMMARY.modelDecision,
    hint: 'не финальное решение',
    hintTone: 'muted' as const,
  },
]

export function AnalystCaseRisksPage() {
  const navigate = useNavigate()
  const { caseId = '' } = useParams()

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 1.5,
          mb: 2,
        }}
      >
        {kpis.map((k) => (
          <Box key={k.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8A96A3' }}>{k.label}</Typography>
            <Typography
              sx={{
                mt: 0.75,
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 18, md: 20 },
                color: '#0B1F35',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {k.value}
            </Typography>
            <Box
              sx={{
                ...statusPill,
                mt: 1,
                bgcolor: k.hintTone === 'ok' ? 'rgba(46,125,50,0.12)' : 'rgba(11,31,53,0.06)',
                color: k.hintTone === 'ok' ? '#2E7D32' : '#7A8795',
              }}
            >
              {k.hint}
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.5 }}>
            Факторы риска
          </Typography>
          <Stack spacing={1}>
            {RISK_SUMMARY.drivers.map((d) => {
              const positive = d.impact === '+'
              return (
                <Stack
                  key={d.label}
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{
                    py: 1.1,
                    px: 1.35,
                    borderRadius: 2,
                    bgcolor: '#F7F8FA',
                  }}
                >
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                      flexShrink: 0,
                      bgcolor: positive ? 'rgba(46,125,50,0.12)' : 'rgba(230,160,24,0.16)',
                      color: positive ? '#2E7D32' : '#C45A12',
                    }}
                  >
                    {d.impact}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 650, color: '#0B1F35' }}>
                    {d.label}
                  </Typography>
                </Stack>
              )
            })}
          </Stack>
        </Box>

        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.5 }}>
            Разделение источников
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {RISK_SUMMARY.sources.map((s, i) => (
              <Box key={s.title}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                  {i + 1}. {s.title}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#7A8795', mt: 0.25 }}>{s.detail}</Typography>
              </Box>
            ))}
          </Stack>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#EF3124', mb: 2 }}>
            LLM не принимает кредитных решений
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              fullWidth
              variant="contained"
              sx={primaryBtn}
              onClick={() => navigate(`/app/analyst/cases/${caseId}/explainability`)}
            >
              К объяснимости
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={primaryBtn}
              onClick={() => navigate(`/app/analyst/cases/${caseId}/decision`)}
            >
              К заключению
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
