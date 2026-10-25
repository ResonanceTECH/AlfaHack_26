import { Box, Button, Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { AnalystCase } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, tileSx } from '@/features/analyst/styles'

export function AnalystCaseOverviewPage() {
  const { caseData: c } = useOutletContext<{ caseData: AnalystCase }>()
  const navigate = useNavigate()
  const base = `/app/analyst/cases/${c.id}`

  const rows = [
    { label: 'Цель', value: c.purpose },
    { label: 'Финансы', value: 'Выручка 4,8 млн/мес · NCF +420 тыс · DSCR 1,42' },
    { label: 'Документы', value: '6/7 принято · 1 запрошен повторно' },
    { label: 'Автопроверки', value: '8 Passed · 1 Warning · 0 Failed' },
    { label: 'Риск', value: 'Категория B+ · PD proxy Low · модель v2.3' },
    { label: 'Следующий шаг', value: 'Завершить проверку выписки → подготовить заключение' },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.75 }}>
          Сводка заявки
        </Typography>
        <Stack spacing={1.5}>
          {rows.map((r) => (
            <Stack
              key={r.label}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.35, sm: 2 }}
              sx={{
                py: 1.1,
                borderBottom: '1px solid rgba(11,31,53,0.06)',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Typography sx={{ width: { sm: 140 }, flexShrink: 0, fontSize: 13, color: '#8A96A3', fontWeight: 600 }}>
                {r.label}
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#0B1F35', fontWeight: 600 }}>{r.value}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          Контекстная панель
        </Typography>
        <Stack spacing={1}>
          <Button fullWidth variant="contained" sx={primaryBtn}>
            Назначена вам
          </Button>
          <Button fullWidth variant="outlined" sx={outlineBtn} onClick={() => navigate(`${base}/documents`)}>
            Запросить документы
          </Button>
          <Button fullWidth variant="contained" sx={primaryBtn} onClick={() => navigate(`${base}/checks`)}>
            Продолжить проверку
          </Button>
          <Button fullWidth variant="outlined" sx={outlineBtn} onClick={() => navigate(`${base}/decision`)}>
            Перейти к решению
          </Button>
          <Button fullWidth variant="outlined" sx={outlineBtn} onClick={() => navigate(`${base}/history`)}>
            История заявки
          </Button>
          <Button fullWidth variant="outlined" sx={outlineBtn} onClick={() => navigate(`${base}/ai`)}>
            AI-резюме
          </Button>
        </Stack>
        <Typography sx={{ mt: 2, fontSize: 11, color: '#8A96A3', lineHeight: 1.5 }}>
          Policy ID: CP-2026.10
          <br />
          RBAC: ANALYST · write decision
        </Typography>
        <Typography sx={{ mt: 1.5, fontSize: 12, color: '#5A6B7D', lineHeight: 1.45 }}>
          Данных достаточно для предварительного одобрения при закрытии замечания по выписке.
        </Typography>
      </Box>
    </Box>
  )
}
