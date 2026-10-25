import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CheckIcon from '@mui/icons-material/Check'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AlfaLogo } from '@/components/landing/AlfaLogo'
import type { Company } from '@/types'

export type WizardStep = 1 | 2 | 3

const STEPS = [
  { n: 1 as const, label: 'Компания', hint: 'Основная информация' },
  { n: 2 as const, label: 'Финансы', hint: 'Доходы, расходы, выписка' },
  { n: 3 as const, label: 'Подтверждение', hint: 'Проверка данных' },
]

type Props = {
  step: WizardStep
  company?: Company | null
  children: ReactNode
  right?: ReactNode
  onBack?: () => void
  onContinue?: () => void
  continueLabel?: string
  continueDisabled?: boolean
  continueLoading?: boolean
  hideFooter?: boolean
}

export function OnboardingWizardLayout({
  step,
  company,
  children,
  right,
  onBack,
  onContinue,
  continueLabel = 'Продолжить',
  continueDisabled,
  continueLoading,
  hideFooter,
}: Props) {
  const { user } = useAuth()
  const initials = (user?.fullName ?? 'ИИ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'ИИ'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F3F5F8', display: 'flex', flexDirection: 'column' }}>
      <Box
        component="header"
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, md: 3 },
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={3}>
          <AlfaLogo to="/app" ink compact />
          <Stack direction="row" spacing={2.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {['Для бизнеса', 'Кредиты', 'Партнёры', 'Сервисы'].map((label, i) => (
              <Typography
                key={label}
                sx={{
                  fontSize: 14,
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? 'text.primary' : 'text.secondary',
                  cursor: 'default',
                }}
              >
                {label}
              </Typography>
            ))}
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <NotificationsNoneIcon />
          </IconButton>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: 'default' }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                {user?.fullName ?? 'Пользователь'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.2 }}>
                {company?.name ?? 'Компания'}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '240px minmax(0, 1fr)',
            lg: right ? '240px minmax(0, 1fr) 280px' : '240px minmax(0, 1fr)',
          },
          gap: 2,
          p: { xs: 1.5, md: 2.5 },
          maxWidth: 1400,
          width: '100%',
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Button
            component={RouterLink}
            to="/app"
            startIcon={<ArrowBackIcon />}
            sx={{
              justifyContent: 'flex-start',
              color: 'text.secondary',
              fontWeight: 600,
              px: 1,
              '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
            }}
          >
            Назад на главную
          </Button>

          {company ? (
            <Box
              sx={{
                bgcolor: '#fff',
                borderRadius: 2.5,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(239,49,36,0.1)',
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <BusinessOutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }} noWrap>
                    {company.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    ИНН {company.inn}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ) : null}

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2.5,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack spacing={0.75}>
              {STEPS.map((s) => {
                const done = s.n < step
                const active = s.n === step
                return (
                  <Stack
                    key={s.n}
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: active ? 'rgba(239,49,36,0.08)' : 'transparent',
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        bgcolor: done ? '#1B8A5A' : active ? 'primary.main' : '#E8EAED',
                        color: done || active ? '#fff' : 'text.secondary',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {done ? <CheckIcon sx={{ fontSize: 16 }} /> : s.n}
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: active ? 700 : 600,
                          fontSize: 14,
                          color: active ? 'primary.main' : done ? 'text.primary' : 'text.secondary',
                        }}
                      >
                        {s.label}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.hint}</Typography>
                    </Box>
                  </Stack>
                )
              })}
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: { md: 560 },
          }}
        >
          <HorizontalStepper current={step} />
          <Box sx={{ flex: 1, mt: 2.5 }}>{children}</Box>
        </Box>

        {right ? (
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <Stack spacing={2}>{right}</Stack>
          </Box>
        ) : null}
      </Box>

      {!hideFooter ? (
        <Box
          sx={{
            bgcolor: '#fff',
            borderTop: '1px solid',
            borderColor: 'divider',
            px: { xs: 2, md: 3 },
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
          }}
        >
          <Button
            startIcon={<HelpOutlineIcon />}
            sx={{ color: 'primary.main', fontWeight: 700, '&:hover': { bgcolor: 'transparent' } }}
            href="mailto:support@alfabank.ru"
          >
            Нужна помощь?
          </Button>
          <Stack direction="row" spacing={1.5}>
            {onBack ? (
              <Button variant="outlined" onClick={onBack} sx={{ px: 3, borderRadius: 2, fontWeight: 600 }}>
                Назад
              </Button>
            ) : null}
            {onContinue ? (
              <Button
                variant="contained"
                onClick={onContinue}
                disabled={continueDisabled || continueLoading}
                sx={{ px: 3, py: 1.1, borderRadius: 2, fontWeight: 700 }}
              >
                {continueLoading ? 'Сохраняем…' : continueLabel}
              </Button>
            ) : null}
          </Stack>
        </Box>
      ) : null}
    </Box>
  )
}

function HorizontalStepper({ current }: { current: WizardStep }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}
    >
      {STEPS.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        return (
          <Stack
            key={s.n}
            direction="row"
            alignItems="center"
            sx={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: done || active ? 'primary.main' : '#E8EAED',
                  color: done || active ? '#fff' : 'text.secondary',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {done ? <CheckIcon sx={{ fontSize: 16 }} /> : s.n}
              </Box>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'primary.main' : 'text.secondary',
                  display: { xs: 'none', sm: 'block' },
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
                  mx: 1.25,
                  minWidth: 20,
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

export function WizardInfoCard({
  title,
  children,
  tone = 'blue',
}: {
  title?: string
  children: ReactNode
  tone?: 'blue' | 'green' | 'yellow'
}) {
  const bg =
    tone === 'green' ? 'rgba(27,138,90,0.08)' : tone === 'yellow' ? 'rgba(217,119,6,0.08)' : '#EBF3FF'
  const border =
    tone === 'green'
      ? 'rgba(27,138,90,0.2)'
      : tone === 'yellow'
        ? 'rgba(217,119,6,0.2)'
        : 'rgba(37,99,235,0.15)'

  return (
    <Box
      sx={{
        bgcolor: bg,
        border: '1px solid',
        borderColor: border,
        borderRadius: 2.5,
        p: 2,
      }}
    >
      {title ? (
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>{title}</Typography>
      ) : null}
      {children}
    </Box>
  )
}

export function StatusChip({ label, color = 'success' }: { label: string; color?: 'success' | 'default' }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        fontWeight: 700,
        fontSize: 12,
        height: 24,
        bgcolor: color === 'success' ? 'rgba(27,138,90,0.12)' : undefined,
        color: color === 'success' ? '#1B8A5A' : undefined,
      }}
    />
  )
}
