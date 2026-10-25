import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { fetchAnalystChecks } from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { checkStatusUi, formatHistoryAt } from '@/features/analyst/map'
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
  const { applicationId, card } = useOutletContext<AnalystCaseOutlet>()

  const checksQ = useQuery({
    queryKey: ['analyst', 'checks', applicationId],
    queryFn: () => fetchAnalystChecks(applicationId),
    enabled: Boolean(applicationId),
  })

  const summary = checksQ.data?.summary ?? card.checksSummary
  const checks = checksQ.data?.checks ?? []

  return (
    <Box sx={{ ...tileSx, p: { xs: 2, md: 2.25 } }}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 0.35 }}>
        Автоматические проверки · {summary.passed}P / {summary.warnings}W / {summary.failed}F · всего{' '}
        {summary.total}
      </Typography>

      {checksQ.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
          <CircularProgress size={28} sx={{ color: '#EF3124' }} />
        </Box>
      )}

      {checksQ.isError && (
        <Typography sx={{ py: 3, color: '#EF3124', fontSize: 14 }}>
          Не удалось загрузить проверки
        </Typography>
      )}

      {!checksQ.isLoading && !checksQ.isError && (
        <Box sx={{ overflow: 'auto', mx: { xs: -0.5, md: 0 }, mt: 1.5 }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Проверка</TableCell>
                <TableCell sx={thSx}>Пояснение</TableCell>
                <TableCell sx={thSx}>Audience</TableCell>
                <TableCell sx={thSx}>Score</TableCell>
                <TableCell sx={thSx}>Статус</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'right' }}>Время</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checks.map((c) => {
                const st = statusUi[checkStatusUi(c.status)]
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ ...tdSx, fontWeight: 650 }}>{c.checkKey}</TableCell>
                    <TableCell sx={tdSx}>{c.explanation || c.reasonCodes.join(', ') || '—'}</TableCell>
                    <TableCell sx={{ ...tdSx, color: '#7A8795' }}>{c.audience || '—'}</TableCell>
                    <TableCell sx={{ ...tdSx, color: '#5A6B7D' }}>
                      {c.score != null ? c.score : '—'}
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Box component="span" sx={{ ...statusPill, bgcolor: st.bg, color: st.color }}>
                        {st.label}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...tdSx, color: '#8A96A3', textAlign: 'right' }}>
                      {c.createdAt ? formatHistoryAt(c.createdAt) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
              {checks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ ...tdSx, color: '#8A96A3' }}>
                    Проверки ещё не запускались
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <Typography sx={{ fontSize: 12.5, color: '#8A96A3', lineHeight: 1.45, maxWidth: 560 }}>
          Данные с `GET /analyst/applications/{'{id}'}/checks`. Internal checks видны аналитику.
        </Typography>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="outlined"
            sx={outlineBtn}
            onClick={() => checksQ.refetch()}
            disabled={checksQ.isFetching}
          >
            Обновить
          </Button>
          <Button
            variant="contained"
            sx={primaryBtn}
            onClick={() => navigate(`/app/analyst/cases/${applicationId}/risks`)}
          >
            К оценке рисков
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
