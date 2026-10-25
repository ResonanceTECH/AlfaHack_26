import { Box, Stack, Typography } from '@mui/material'
import { WORKFLOW_STAGES } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

export function AnalystWorkflowPage() {
  const total = WORKFLOW_STAGES.reduce((s, x) => s + x.count, 0)

  return (
    <Box>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: 22, md: 26 },
          color: '#0B1F35',
          letterSpacing: '-0.02em',
          mb: 0.5,
        }}
      >
        Рабочий процесс и SLA
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', mb: 2.5 }}>
        Конвейер рассмотрения · {total} заявок на стадиях
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {WORKFLOW_STAGES.map((s) => (
          <Box key={s.key} sx={tileSx}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8A96A3', letterSpacing: '0.04em' }}>
              {s.label.toUpperCase()}
            </Typography>
            <Typography
              sx={{
                mt: 1,
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 28,
                color: '#0B1F35',
                letterSpacing: '-0.02em',
              }}
            >
              {s.count}
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 13, color: '#7A8795' }}>
              целевой SLA · {s.sla}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0B1F35', mb: 1.5 }}>
          Контроль SLA сегодня
        </Typography>
        <Stack spacing={1.25}>
          {[
            { label: 'Просрочено', value: '2', color: '#EF3124' },
            { label: 'Менее 4 часов', value: '3', color: '#E6A018' },
            { label: 'В норме', value: String(total - 5), color: '#2E7D32' },
          ].map((r) => (
            <Stack
              key={r.label}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                py: 1,
                px: 1.5,
                borderRadius: 2,
                bgcolor: '#F7F8FA',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0B1F35' }}>{r.label}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: r.color }}>{r.value}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
