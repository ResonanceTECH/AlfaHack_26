import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Box, Link as MuiLink, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import buildingsImg from '@/assets/alfa-buildings.png'

type AuthShellProps = {
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, children, footer }: AuthShellProps) {
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
            p: { xs: 3, sm: 4.5 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: 'none',
              width: 'fit-content',
              mb: 3.5,
              '&:hover': { opacity: 0.85 },
            }}
          >
            <Typography
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              Альфа Банк
            </Typography>
            <Box
              sx={{
                width: 36,
                height: 3,
                bgcolor: 'primary.main',
                borderRadius: 1,
                mt: 0.35,
              }}
            />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              mb: 3,
              lineHeight: 1.2,
              fontSize: { xs: '1.5rem', sm: '1.8rem' },
              color: '#0B1F35',
            }}
          >
            {title}
          </Typography>

          <Box sx={{ flex: 1 }}>{children}</Box>

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
          <Stack spacing={1.75} sx={{ position: 'relative', zIndex: 2, p: 4.5, maxWidth: 340 }}>
            <Box
              aria-hidden
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                border: '2.5px solid #fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1,
                mb: 0.5,
              }}
            >
              A
            </Box>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: '1.7rem',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Развиваем бизнес вместе
            </Typography>
            <Typography sx={{ opacity: 0.95, fontSize: 15, lineHeight: 1.45, maxWidth: 280 }}>
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
        sx={{
          color: 'primary.main',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.35,
        }}
      >
        {label}
        <ArrowForwardIcon sx={{ fontSize: 16 }} />
      </MuiLink>
    </Typography>
  )
}
