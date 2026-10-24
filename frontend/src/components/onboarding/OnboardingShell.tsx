import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { Box, Button, Divider, Link as MuiLink, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export type OnboardingStep = 1 | 2 | 3

const STEPS = [
  { n: 1 as const, label: 'Компания' },
  { n: 2 as const, label: 'Финансы' },
  { n: 3 as const, label: 'Подтверждение' },
]

type OnboardingShellProps = {
  step: OnboardingStep
  title: string
  children: ReactNode
  sidebar: ReactNode
}

export function OnboardingShell({ step, title, children, sidebar }: OnboardingShellProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#F5F6F8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        component="header"
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, md: 4 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              A
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Альфа Банк</Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Typography sx={{ fontSize: 14, color: 'text.secondary', fontWeight: 500 }}>
            Кредит для бизнеса
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            component={MuiLink}
            href="mailto:support@alfabank.ru"
            startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              textDecoration: 'none',
              '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
            }}
          >
            Поддержка
          </Button>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 20, alignSelf: 'center' }} />
          <Button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            endIcon={<LogoutOutlinedIcon sx={{ fontSize: 18 }} />}
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
            }}
          >
            Выйти
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 1040,
          mx: 'auto',
          px: { xs: 1.5, sm: 2 },
          py: { xs: 2, sm: 3 },
        }}
      >
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(11,31,53,0.08)',
            overflow: 'hidden',
            minHeight: { md: 640 },
          }}
        >
          <Box sx={{ px: { xs: 2.5, md: 4 }, pt: 3, pb: 2 }}>
            <OnboardingStepper current={step} />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
              gap: 0,
              px: { xs: 2.5, md: 4 },
              pb: { xs: 3, md: 4 },
            }}
          >
            <Box sx={{ pr: { md: 4 }, pb: { xs: 3, md: 0 } }}>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  mb: 3,
                  fontSize: { xs: '1.45rem', sm: '1.75rem' },
                  lineHeight: 1.2,
                }}
              >
                {title}
              </Typography>
              {children}
            </Box>

            <Box
              sx={{
                bgcolor: '#F7F8FA',
                borderRadius: 2.5,
                p: { xs: 2.5, md: 3 },
                alignSelf: 'start',
              }}
            >
              {sidebar}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function OnboardingStepper({ current }: { current: OnboardingStep }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={0}
      sx={{ maxWidth: 520, mx: 'auto' }}
    >
      {STEPS.map((s, i) => {
        const active = s.n === current
        const done = s.n < current
        return (
          <Stack key={s.n} direction="row" alignItems="center" sx={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  bgcolor: active || done ? 'primary.main' : '#E8EAED',
                  color: active || done ? '#fff' : 'text.secondary',
                }}
              >
                {s.n}
              </Box>
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'primary.main' : 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </Typography>
            </Stack>
            {i < STEPS.length - 1 ? (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  mx: 1.5,
                  minWidth: 24,
                  bgcolor: done ? 'primary.main' : '#E8EAED',
                  borderRadius: 1,
                }}
              />
            ) : null}
          </Stack>
        )
      })}
    </Stack>
  )
}

export function WhyNeededSidebar() {
  const items = [
    {
      title: 'Персональный подбор кредита',
      text: 'Предложим условия, которые подходят именно вашему бизнесу',
      icon: 'sliders',
    },
    {
      title: 'Быстрое рассмотрение заявки',
      text: 'Предварительное решение уже в течение нескольких минут',
      icon: 'bolt',
    },
    {
      title: 'Минимум документов',
      text: 'Нужен только ИНН и несколько основных данных',
      icon: 'doc',
    },
    {
      title: 'Рекомендации по продукту',
      text: 'Подскажем оптимальную сумму и срок кредита',
      icon: 'chart',
    },
  ] as const

  return (
    <>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: '1.15rem',
          mb: 2.5,
          letterSpacing: '-0.02em',
        }}
      >
        Зачем это нужно?
      </Typography>
      <Stack spacing={2.25}>
        {items.map((item) => (
          <Stack key={item.title} direction="row" spacing={1.5} alignItems="flex-start">
            <SidebarIcon kind={item.icon} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.35, lineHeight: 1.3 }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.4 }}>
                {item.text}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </>
  )
}

function SidebarIcon({ kind }: { kind: 'sliders' | 'bolt' | 'doc' | 'chart' }) {
  const paths: Record<typeof kind, ReactNode> = {
    sliders: (
      <>
        <path d="M4 8h10M18 8h2" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="8" r="2" fill="currentColor" stroke="none" />
        <path d="M4 16h2M10 16h10" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="16" r="2" fill="currentColor" stroke="none" />
      </>
    ),
    bolt: (
      <path
        d="M13 3L5.5 13h5l-1 8L17.5 11h-5L13 3z"
        fill="currentColor"
        stroke="none"
      />
    ),
    doc: (
      <>
        <path
          d="M7 3.5h7l3 3V20a1.5 1.5 0 01-1.5 1.5h-8.5A1.5 1.5 0 015.5 20V5A1.5 1.5 0 017 3.5z"
          strokeWidth="1.6"
          fill="none"
        />
        <path d="M14 3.5V7h3.5M8.5 12h7M8.5 15.5h5" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    chart: (
      <>
        <path d="M5 19V11M10 19V7M15 19v-5M20 19V9" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  }

  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.25,
        bgcolor: 'rgba(239,49,36,0.1)',
        color: 'primary.main',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 24 24"
        sx={{ width: 18, height: 18 }}
        fill="none"
        stroke="currentColor"
      >
        {paths[kind]}
      </Box>
    </Box>
  )
}
