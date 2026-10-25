import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { AUTOCHECKS } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'

const statusUi = {
  pass: { label: 'Passed', bg: 'rgba(46,125,50,0.12)', color: '#2E7D32' },
  warn: { label: 'Warning', bg: 'rgba(230,160,24,0.16)', color: '#B86B12' },
  fail: { label: 'Failed', bg: 'rgba(239,49,36,0.1)', color: '#EF3124' },
} as const

const thSx = {
  fontSize: 12,
  fontWeight: 700,
  color: '#8A96A3',
  borderBottom: '1px solid rgba(11,31,53,0.08)',
  bgcolor: '#fff',
  py: 1.25,
  whiteSpace: 'nowrap',
} as const

const tdSx = {
  fontSize: 13.5,
  color: '#0B1F35',
  borderBottom: '1px solid rgba(11,31,53,0.06)',
  py: 1.35,
  verticalAlign: 'middle',
} as const

export function AnalystCaseChecksPage() {
  const navigate = useNavigate()
  const { caseId = 'ABC-2026-1042' } = useParams()

  return (
    <Box sx={{ ...tileSx, p: { xs: 2, md: 2.25 } }}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 0.35 }}>
        Автоматические проверки · Policy CP-2026.10 · ruleset v1.4
      </Typography>

      <Box sx={{ overflow: 'auto', mx: { xs: -0.5, md: 0 }, mt: 1.5 }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Проверка</TableCell>
              <TableCell sx={thSx}>Факт</TableCell>
              <TableCell sx={thSx}>Условие</TableCell>
              <TableCell sx={thSx}>Источник</TableCell>
              <TableCell sx={thSx}>Статус</TableCell>
              <TableCell sx={{ ...thSx, textAlign: 'right' }}>Время</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {AUTOCHECKS.map((c) => {
              const st = statusUi[c.result]
              return (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ ...tdSx, fontWeight: 650 }}>{c.title}</TableCell>
                  <TableCell sx={tdSx}>{c.fact}</TableCell>
                  <TableCell sx={{ ...tdSx, color: '#5A6B7D' }}>{c.condition}</TableCell>
                  <TableCell sx={{ ...tdSx, color: '#7A8795' }}>{c.source}</TableCell>
                  <TableCell sx={tdSx}>
                    <Box component="span" sx={{ ...statusPill, bgcolor: st.bg, color: st.color }}>
                      {st.label}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...tdSx, color: '#8A96A3', textAlign: 'right' }}>{c.at}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <Typography sx={{ fontSize: 12.5, color: '#8A96A3', lineHeight: 1.45, maxWidth: 560 }}>
          Failed = техническая ошибка. Warning по документам не блокирует ручной разбор, но блокирует
          PREAPPROVED до закрытия.
        </Typography>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button variant="outlined" sx={outlineBtn}>
            Пересчитать проверки
          </Button>
          <Button
            variant="contained"
            sx={primaryBtn}
            onClick={() => navigate(`/app/analyst/cases/${caseId}/risks`)}
          >
            К оценке рисков
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
