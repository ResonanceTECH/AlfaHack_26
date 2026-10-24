import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { Box, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

const NAV: { label: string; icon: ReactNode; active?: boolean }[] = [
  { label: 'Обзор', icon: <DashboardOutlinedIcon sx={{ fontSize: 16 }} /> },
  {
    label: 'Профиль компании',
    icon: <BusinessOutlinedIcon sx={{ fontSize: 16 }} />,
    active: true,
  },
  { label: 'Зачем кредит', icon: <FlagOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'AI-консультант', icon: <SmartToyOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Подбор кредитов', icon: <RecommendOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Сравнение', icon: <CompareArrowsOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Калькулятор', icon: <CalculateOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Заявки', icon: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Выписка', icon: <AccountBalanceOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Прогноз cash flow', icon: <ShowChartOutlinedIcon sx={{ fontSize: 16 }} /> },
  { label: 'Scenario Lab', icon: <ScienceOutlinedIcon sx={{ fontSize: 16 }} /> },
]

/** Decorative mock of real entrepreneur cabinet — right side of hero */
export function CabinetPreview() {
  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        maxWidth: { xs: 420, md: 480 },
        height: { xs: 320, md: 380 },
        mx: { xs: 'auto', md: 0 },
        justifySelf: { md: 'end' },
        bgcolor: '#fff',
        borderRadius: 3.5,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        color: '#0B1F35',
        display: 'grid',
        gridTemplateColumns: '148px 1fr',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          borderRight: '1px solid rgba(11,31,53,0.08)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#fff',
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            px: 1.5,
            pt: 1.75,
            pb: 1,
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.02em',
          }}
        >
          Кабинет
        </Typography>

        <Box sx={{ flex: 1, overflow: 'hidden', px: 0.75 }}>
          {NAV.map((item) => (
            <Box
              key={item.label}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.55,
                mb: 0.15,
                borderRadius: 1.5,
                fontSize: 11,
                fontWeight: item.active ? 700 : 500,
                color: item.active ? '#EF3124' : '#3A4A5C',
                bgcolor: item.active ? 'rgba(239,49,36,0.1)' : 'transparent',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                '& .MuiSvgIcon-root': {
                  color: item.active ? '#EF3124' : '#6B7C8F',
                  flexShrink: 0,
                },
              }}
            >
              {item.icon}
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ px: 1.25, py: 1.25, borderTop: '1px solid rgba(11,31,53,0.08)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>Иван Петров</Typography>
          <Box
            sx={{
              display: 'inline-block',
              mt: 0.5,
              mb: 0.75,
              px: 0.75,
              py: 0.15,
              borderRadius: 1,
              bgcolor: '#EEF0F3',
              fontSize: 9,
              color: '#5A6B7D',
              fontWeight: 600,
            }}
          >
            Предприниматель
          </Box>
          <Box
            sx={{
              border: '1px solid rgba(11,31,53,0.12)',
              borderRadius: 1.5,
              py: 0.5,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#3A4A5C',
            }}
          >
            Выйти
          </Box>
        </Box>
      </Box>

      {/* Main */}
      <Box
        sx={{
          bgcolor: '#F3F5F8',
          p: 1.75,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
          backgroundImage:
            'radial-gradient(500px 280px at 100% -10%, rgba(239,49,36,0.08), transparent 55%)',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.02em',
            mb: 1.5,
            mt: 0.25,
          }}
        >
          Профиль компании
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
            bgcolor: '#FFF8E6',
            border: '1px solid #F5D78E',
            borderLeft: '3px solid #E6A817',
            borderRadius: 1.5,
            px: 1.25,
            py: 1,
            mb: 1.5,
          }}
        >
          <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#C98900', mt: 0.1 }} />
          <Typography sx={{ fontSize: 11, color: '#5A4A20', lineHeight: 1.35 }}>
            Нет компании для этого аккаунта.
          </Typography>
        </Box>

        <Stack spacing={1} sx={{ flex: 1 }}>
          {[
            { title: 'Рекомендация готова', body: 'Оборотный · от 14%', unread: true },
            { title: 'Менеджер ответил', body: 'Нужны 2 документа по заявке', unread: true },
            { title: 'Прогноз cash flow', body: 'Риск разрыва в апреле', unread: false },
          ].map((n) => (
            <Box
              key={n.title}
              sx={{
                bgcolor: '#fff',
                borderRadius: 2,
                px: 1.25,
                py: 1,
                boxShadow: '0 1px 3px rgba(11,31,53,0.06)',
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: n.unread ? '#EF3124' : '#C5CCD4',
                  mt: 0.55,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
                  {n.title}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#5A6B7D', lineHeight: 1.3 }}>
                  {n.body}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
