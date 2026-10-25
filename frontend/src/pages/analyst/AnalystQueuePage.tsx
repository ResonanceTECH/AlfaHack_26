import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_CASES, type AnalystCaseStatus } from '@/features/analyst/demoData'
import { outlineBtn, tileSx } from '@/features/analyst/styles'
import { StatusChip } from '@/components/analyst/AnalystCaseShell'
import { formatMoney } from '@/utils/format'

const ALL = 'all'

export function AnalystQueuePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState(ALL)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    return DEMO_CASES.filter((c) => {
      if (status !== ALL && c.status !== status) return false
      if (!q.trim()) return true
      const s = q.trim().toLowerCase()
      return (
        c.id.toLowerCase().includes(s) ||
        c.company.toLowerCase().includes(s) ||
        c.inn.includes(s)
      )
    })
  }, [status, q])

  const statuses = useMemo(
    () => Array.from(new Set(DEMO_CASES.map((c) => c.status))) as AnalystCaseStatus[],
    [],
  )

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
        Общая очередь банка · {rows.length} в списке
      </Typography>

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
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        {rows.map((c, i) => (
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
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{c.id}</Typography>
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
        {rows.length === 0 && (
          <Typography sx={{ p: 3, color: '#7A8795', fontSize: 14 }}>Ничего не найдено</Typography>
        )}
      </Box>
    </Box>
  )
}
