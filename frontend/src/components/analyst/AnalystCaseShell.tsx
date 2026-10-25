import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { Link as RouterLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CASE_TABS, getCase } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, statusPill } from '@/features/analyst/styles'
import { formatMoney } from '@/utils/format'

function tabPath(caseId: string, key: string) {
  return key ? `/app/analyst/cases/${caseId}/${key}` : `/app/analyst/cases/${caseId}`
}

export function AnalystCaseShell() {
  const { caseId = '' } = useParams()
  const c = getCase(caseId)
  const navigate = useNavigate()
  const location = useLocation()
  const base = `/app/analyst/cases/${c.id}`
  const rest = location.pathname.slice(base.length).replace(/^\//, '')
  const activeTab = rest.split('/')[0] ?? ''

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 20, md: 24 },
              color: '#0B1F35',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {c.id} · {c.company}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: '#7A8795' }}>
            ИНН {c.inn} · {c.product} · {formatMoney(c.amount)} · {c.termMonths} мес.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Box
              sx={{
                ...statusPill,
                bgcolor: 'rgba(242, 153, 74, 0.16)',
                color: '#B86B12',
              }}
            >
              {c.status}
            </Box>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color: c.slaUrgent ? '#EF3124' : '#5A6B7D',
              }}
            >
              {c.slaLabel}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#7A8795' }}>Аналитик: {c.analyst}</Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="outlined"
            sx={outlineBtn}
            onClick={() => navigate(`/app/analyst/cases/${c.id}/documents`)}
          >
            Запросить
          </Button>
          <Button
            variant="contained"
            sx={primaryBtn}
            onClick={() => navigate(`/app/analyst/cases/${c.id}/decision`)}
          >
            К решению
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, md: 2.5 },
          overflowX: 'auto',
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          mb: 2.5,
          pb: 0,
        }}
      >
        {CASE_TABS.map((t) => {
          const selected = activeTab === t.key
          return (
            <Box
              key={t.key || 'overview'}
              component={RouterLink}
              to={tabPath(c.id, t.key)}
              sx={{
                flexShrink: 0,
                textDecoration: 'none',
                pb: 1.1,
                px: 0.25,
                fontSize: 13.5,
                fontWeight: selected ? 700 : 600,
                color: selected ? '#0B1F35' : '#7A8795',
                borderBottom: selected ? '2px solid #EF3124' : '2px solid transparent',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
            </Box>
          )
        })}
      </Box>

      <Outlet context={{ caseData: c }} />
    </Box>
  )
}

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        height: 24,
        borderRadius: 1.25,
        fontWeight: 700,
        fontSize: 11,
        bgcolor: 'rgba(242, 153, 74, 0.16)',
        color: '#B86B12',
        '& .MuiChip-label': { px: 1 },
      }}
    />
  )
}
