import { Box, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { useOutletContext } from 'react-router-dom'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { companyAgeLabel, formatCompactMoney } from '@/features/analyst/map'
import { tileSx } from '@/features/analyst/styles'
import { formatDate, formatMoney } from '@/utils/format'

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.25, sm: 2 }}
      sx={{
        py: 1,
        borderBottom: '1px solid rgba(11,31,53,0.06)',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography sx={{ width: { sm: 140 }, flexShrink: 0, fontSize: 13, color: '#8A96A3', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#0B1F35', fontWeight: 600 }}>{value}</Typography>
    </Stack>
  )
}

export function AnalystCaseCompanyPage() {
  const { card } = useOutletContext<AnalystCaseOutlet>()
  const co = card.company
  const fin = card.financials

  const kpis = fin
    ? [
        { label: 'Выручка / мес', value: formatCompactMoney(fin.avgMonthlyRevenue) },
        { label: 'Расходы / мес', value: formatCompactMoney(fin.operatingExpenses) },
        { label: 'Остаток', value: formatCompactMoney(fin.cashBalance) },
        { label: 'Обязательства', value: formatCompactMoney(fin.liabilities) },
        { label: 'Активные кредиты', value: formatCompactMoney(fin.activeCredits) },
        { label: 'Период', value: fin.period || '—' },
      ]
    : []

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.25 }}>
            Профиль компании
          </Typography>
          {co ? (
            <>
              <Kv label="Тип" value={co.legalForm} />
              <Kv label="Наименование" value={co.name} />
              <Kv label="ИНН / ОГРН" value={`${co.inn} / ${co.ogrn || '—'}`} />
              <Kv
                label="Дата регистрации"
                value={`${co.registrationDate ? formatDate(co.registrationDate) : '—'} · ${companyAgeLabel(co.registrationDate)}`}
              />
              <Kv label="Отрасль" value={co.industry || '—'} />
              <Kv label="Регион" value={co.region || '—'} />
              <Kv label="Сотрудники" value={String(co.employeesCount)} />
              <Kv label="Реестр" value={co.registryStatus} />
              {co.registryStatus === 'ACTIVE' && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{
                    mt: 1.75,
                    display: 'inline-flex',
                    px: 1.25,
                    py: 0.65,
                    borderRadius: 2,
                    bgcolor: 'rgba(46, 125, 50, 0.1)',
                    color: '#2E7D32',
                    width: 'fit-content',
                  }}
                >
                  <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Данные подтверждены</Typography>
                </Stack>
              )}
            </>
          ) : (
            <Typography sx={{ fontSize: 14, color: '#8A96A3' }}>Компания не найдена в карточке</Typography>
          )}
        </Box>

        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.25 }}>
            Заявка
          </Typography>
          <Kv label="Номер" value={card.application.applicationNumber} />
          <Kv label="Продукт" value={card.application.productName || '—'} />
          <Kv label="Сумма" value={formatMoney(card.application.amount)} />
          <Kv label="Срок" value={`${card.application.termMonths} мес.`} />
          <Kv label="Ставка" value={`${card.application.rate}%`} />
          <Kv label="Аналитик" value={card.application.assignedManagerName || '—'} />
          <Kv label="Цель" value={card.application.purpose || '—'} />
        </Box>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.75 }}>
          Ключевые финансовые показатели
        </Typography>
        {kpis.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: '#8A96A3' }}>Финансовый снимок отсутствует</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
              gap: 1.5,
            }}
          >
            {kpis.map((k) => (
              <Box
                key={k.label}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: '#F7F8FA',
                  border: '1px solid rgba(11,31,53,0.04)',
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#8A96A3', mb: 0.75 }}>
                  {k.label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 18,
                    color: '#0B1F35',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {k.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {fin && (
          <Typography sx={{ mt: 1.75, fontSize: 12, color: '#8A96A3' }}>
            Источник: {fin.source || '—'} · подтверждено: {fin.confirmed ? 'да' : 'нет'}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
