import { Box, Link as MuiLink, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import buildingsImg from '@/assets/alfa-buildings.png'
import { AlfaLogo } from '@/components/landing/AlfaLogo'

type AuthShellProps = {
  title: string
  subtitle?: ReactNode
  beforeTitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, beforeTitle, children, footer }: AuthShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: { xs: 1.5, sm: 2 },
        py: { xs: 2, sm: 3 },
        background: '#ECEFF3',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 980,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          bgcolor: '#fff',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(11,31,53,0.14)',
          minHeight: { md: 640 },
        }}
      >
        <Box
          sx={{
            p: { xs: 3.25, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ mb: 4, width: 'fit-content' }}>
            <AlfaLogo ink compact />
          </Box>

          {beforeTitle ? <Box sx={{ mb: 2 }}>{beforeTitle}</Box> : null}

          <Typography
            variant="h4"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              mb: subtitle ? 1.25 : 3.5,
              lineHeight: 1.15,
              fontSize: { xs: '1.85rem', sm: '2.35rem' },
              color: '#0B1F35',
            }}
          >
            {title}
          </Typography>

          {subtitle ? (
            <Typography
              sx={{
                mb: 3.5,
                color: '#8A94A6',
                fontSize: 14.5,
                lineHeight: 1.45,
                maxWidth: 360,
              }}
            >
              {subtitle}
            </Typography>
          ) : null}

          <Box sx={{ flex: 1, maxWidth: 400 }}>{children}</Box>

          {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
        </Box>

        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            position: 'relative',
            color: '#fff',
            bgcolor: '#EF3124',
            m: 1.25,
            borderRadius: 2.5,
            overflow: 'hidden',
            minHeight: 560,
          }}
        >
          <Stack
            spacing={1.5}
            sx={{
              position: 'relative',
              zIndex: 2,
              // Match left title baseline: left pad − panel margin + logo spacer
              pt: { xs: 2, sm: 3.75 },
              px: { xs: 3.25, sm: 5 },
              pb: 4.5,
              maxWidth: 380,
            }}
          >
            <Box sx={{ mb: 4, height: 28 }} aria-hidden />
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.85rem', sm: '2.35rem' },
                letterSpacing: '-0.035em',
                lineHeight: 1.15,
              }}
            >
              Развиваем бизнес вместе
            </Typography>
            <Typography sx={{ opacity: 0.95, fontSize: 16, lineHeight: 1.45, maxWidth: 320 }}>
              Финансовые решения для роста на каждом этапе
            </Typography>
          </Stack>

          <Box
            component="img"
            src={buildingsImg}
            alt=""
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '62%',
              objectFit: 'cover',
              objectPosition: 'center bottom',
              zIndex: 1,
              pointerEvents: 'none',
              // PNG с чёрным фоном: на красной панели проявляем только светлые/цветные пиксели
              mixBlendMode: 'screen',
              opacity: 0.95,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(180deg, #EF3124 0%, #EF3124 36%, rgba(239,49,36,0.55) 58%, rgba(180,20,12,0.15) 100%)',
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>
    </Box>
  )
}

export function AuthFooterLink({
  prompt,
  to,
  label,
}: {
  prompt: string
  to: string
  label: string
}) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ textAlign: 'center', fontSize: 14 }}
    >
      {prompt}{' '}
      <MuiLink
        component={RouterLink}
        to={to}
        underline="hover"
        sx={{ color: 'primary.main', fontWeight: 700 }}
      >
        {label}
      </MuiLink>
    </Typography>
  )
}
