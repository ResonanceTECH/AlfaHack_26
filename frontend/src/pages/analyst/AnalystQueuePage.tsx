import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchAnalystQueue } from '@/api/analyst'
import { StatusChip } from '@/components/analyst/AnalystCaseShell'
import { readLastAnalystCaseId } from '@/features/analyst/lastCase'
import { queueItemToCase } from '@/features/analyst/map'
import { outlineBtn, tileSx } from '@/features/analyst/styles'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/utils/format'

const ALL = 'all'

export function AnalystQueuePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [status, setStatus] = useState(ALL)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const missingCase = (location.state as { caseMissing?: string } | null)?.caseMissing

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  // one-shot: вычистить legacy ABC-… из last case при заходе в кабинет
  useEffect(() => {
    readLastAnalystCaseId()
  }, [])

  const queueQ = useQuery({
    queryKey: ['analyst', 'queue', status, qDebounced],
    queryFn: () =>
      fetchAnalystQueue({
        status: status === ALL ? undefined : status,
        q: qDebounced || undefined,
        limit: 50,
      }),
  })

  const rows = useMemo(
    () => (queueQ.data?.items ?? []).map((i) => queueItemToCase(i, { myUserId: user?.id })),
    [queueQ.data, user?.id],
  )

  const statuses = useMemo(() => {
    const keys = Object.keys(queueQ.data?.countsByStatus ?? {})
    return keys.length ? keys.sort() : Array.from(new Set(rows.map((r) => r.status)))
  }, [queueQ.data, rows])

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
        Очередь заявок
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', mb: 2.5 }}>
        Общая очередь банка · {queueQ.data?.total ?? '…'} в списке
      </Typography>

      {missingCase && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }} onClose={() => navigate('.', { replace: true, state: {} })}>
          Заявка «{missingCase}» больше недоступна. Откройте актуальную из списка.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Поиск по ID, компании, ИНН…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <TextField
          select
          size="small"
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 200, bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        >
          <MenuItem value={ALL}>Все</MenuItem>
          {statuses.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
              {queueQ.data?.countsByStatus?.[s] != null
                ? ` · ${queueQ.data.countsByStatus[s]}`
                : ''}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        {queueQ.isLoading && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#EF3124' }} />
          </Box>
        )}
        {queueQ.isError && (
          <Typography sx={{ p: 3, color: '#EF3124', fontSize: 14 }}>
            Не удалось загрузить очередь
          </Typography>
        )}
        {!queueQ.isLoading &&
          !queueQ.isError &&
          rows.map((c, i) => (
            <Stack
              key={c.id}
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={1.5}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.75,
                borderTop: i === 0 ? 'none' : '1px solid rgba(11,31,53,0.06)',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>
                    {c.number || c.id}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: '#0B1F35' }}>{c.company}</Typography>
                  <StatusChip status={c.status} />
                </Stack>
                <Typography sx={{ mt: 0.5, fontSize: 13, color: '#7A8795' }}>
                  {c.product} · {formatMoney(c.amount)} · {c.nextStep}
                  {c.slaUrgent ? (
                    <Box component="span" sx={{ color: '#EF3124', fontWeight: 700 }}>
                      {' '}
                      · {c.slaLabel}
                    </Box>
                  ) : (
                    ` · ${c.slaLabel}`
                  )}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                sx={{ ...outlineBtn, flexShrink: 0 }}
                onClick={() => navigate(`/app/analyst/cases/${c.id}`)}
              >
                Открыть
              </Button>
            </Stack>
          ))}
        {!queueQ.isLoading && !queueQ.isError && rows.length === 0 && (
          <Typography sx={{ p: 3, color: '#7A8795', fontSize: 14 }}>Ничего не найдено</Typography>
        )}
      </Box>
    </Box>
  )
}
