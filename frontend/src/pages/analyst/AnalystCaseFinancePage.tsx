import { Box, Typography } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { formatCompactMoney } from '@/features/analyst/map'
import { tileSx } from '@/features/analyst/styles'

export function AnalystCaseFinancePage() {
  const { card } = useOutletContext<AnalystCaseOutlet>()
  const fin = card.financials

  const kpis = fin
    ? [
        { label: 'Выручка / мес', value: formatCompactMoney(fin.avgMonthlyRevenue) },
        { label: 'Расходы / мес', value: formatCompactMoney(fin.operatingExpenses) },
        { label: 'Остаток на счетах', value: formatCompactMoney(fin.cashBalance) },
        { label: 'Обязательства', value: formatCompactMoney(fin.liabilities) },
        { label: 'Активные кредиты', value: formatCompactMoney(fin.activeCredits) },
        {
          label: 'Свободный поток',
          value: formatCompactMoney(fin.avgMonthlyRevenue - fin.operatingExpenses),
        },
      ]
    : []

  const rev = fin?.avgMonthlyRevenue ?? 0
  const exp = fin?.operatingExpenses ?? 0
  const max = Math.max(rev, exp, 1)
  const months = ['−5', '−4', '−3', '−2', '−1', 'Тек'].map((m, i) => {
    const wobble = 0.92 + ((i * 7) % 5) * 0.02
    return { m, rev: rev * wobble, exp: exp * wobble }
  })

  return (
    <Box>
      {!fin && (
        <Box sx={{ ...tileSx, mb: 2 }}>
          <Typography sx={{ fontSize: 14, color: '#8A96A3' }}>
            Финансовый снимок по компании отсутствует
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
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
                fontSize: 22,
                color: '#0B1F35',
                letterSpacing: '-0.02em',
              }}
            >
              {k.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {fin && (
        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 2 }}>
            Динамика (прокси от снимка {fin.period || '—'})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 1.25,
              alignItems: 'end',
              minHeight: 160,
            }}
          >
            {months.map((x) => (
              <Box key={x.m} sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    height: 120,
                  }}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: `${(x.rev / max) * 100}%`,
                      borderRadius: 1,
                      bgcolor: '#EF3124',
                    }}
                  />
                  <Box
                    sx={{
                      width: 14,
                      height: `${(x.exp / max) * 100}%`,
                      borderRadius: 1,
                      bgcolor: 'rgba(11,31,53,0.18)',
                    }}
                  />
                </Box>
                <Typography sx={{ mt: 1, fontSize: 11, fontWeight: 600, color: '#8A96A3' }}>
                  {x.m}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: 2, fontSize: 12, color: '#8A96A3' }}>
            Красный — выручка · серый — расходы · по данным финансового снимка
            {fin.period ? ` за ${fin.period}` : ''}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
