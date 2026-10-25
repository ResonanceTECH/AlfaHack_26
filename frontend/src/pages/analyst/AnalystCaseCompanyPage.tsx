import { Box, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { APPLICANT, COMPANY_PROFILE, FIN_KPIS } from '@/features/analyst/demoData'
import { tileSx } from '@/features/analyst/styles'

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
  const p = COMPANY_PROFILE

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
          <Kv label="Тип" value={p.type} />
          <Kv label="Наименование" value={p.name} />
          <Kv label="ИНН / ОГРН" value={`${p.inn} / ${p.ogrn}`} />
          <Kv label="Дата регистрации" value={`${p.registeredAt} · ${p.age}`} />
          <Kv label="ОКВЭД" value={p.okved} />
          <Kv label="Источник" value={p.source} />
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
        </Box>

        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.25 }}>
            Заявитель и контакты
          </Typography>
          <Kv label="ФИО" value={APPLICANT.fullName} />
          <Kv label="Роль" value={APPLICANT.role} />
          <Kv label="Телефон" value={APPLICANT.phone} />
          <Kv label="Email" value={APPLICANT.email} />
          <Kv label="История в ABC" value={APPLICANT.history} />
        </Box>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.75 }}>
          Ключевые финансовые показатели
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
            gap: 1.5,
          }}
        >
          {FIN_KPIS.map((k) => (
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
        <Typography sx={{ mt: 1.75, fontSize: 12, color: '#8A96A3' }}>
          Методика: агрегация выписки за 6 месяцев · демо-данные для прототипа.
        </Typography>
      </Box>
    </Box>
  )
}
