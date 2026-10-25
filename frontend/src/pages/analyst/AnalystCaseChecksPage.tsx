import { Box, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import { AUTOCHECKS } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

const icon = {
  pass: <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#2E7D32' }} />,
  warn: <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#E6A018' }} />,
  fail: <CancelRoundedIcon sx={{ fontSize: 20, color: '#EF3124' }} />,
}

export function AnalystCaseChecksPage() {
  const pass = AUTOCHECKS.filter((c) => c.result === 'pass').length
  const warn = AUTOCHECKS.filter((c) => c.result === 'warn').length
  const fail = AUTOCHECKS.filter((c) => (c.result as string) === 'fail').length

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {[
          { label: 'Passed', value: pass, color: '#2E7D32' },
          { label: 'Warning', value: warn, color: '#E6A018' },
          { label: 'Failed', value: fail, color: '#EF3124' },
        ].map((s) => (
          <Box key={s.label} sx={{ ...tileSx, minWidth: 120, py: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: '#8A96A3', fontWeight: 600 }}>{s.label}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Stack>

      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        {AUTOCHECKS.map((c, i) => (
          <Stack
            key={c.id}
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{
              px: 2.25,
              py: 1.5,
              borderTop: i === 0 ? 'none' : '1px solid rgba(11,31,53,0.06)',
            }}
          >
            <Box sx={{ mt: 0.15 }}>{icon[c.result]}</Box>
            <Box>
              <Typography sx={{ fontWeight: 650, fontSize: 14, color: '#0B1F35' }}>{c.title}</Typography>
              {c.note && (
                <Typography sx={{ mt: 0.35, fontSize: 13, color: '#7A8795' }}>{c.note}</Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Box>
    </Box>
  )
}
