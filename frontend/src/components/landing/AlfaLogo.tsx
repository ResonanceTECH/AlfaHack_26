import { Box, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

type AlfaLogoProps = {
  /** Route target. Pass `false` for a non-navigating mark (design-system demos). Default `/`. */
  to?: string | false
  compact?: boolean
  /** Light surfaces (cabinet sidebar) vs dark hero */
  ink?: boolean
  /** Icon only — no wordmark */
  markOnly?: boolean
}

/** UI mark — `frontend/public/logo.png` */
export const BRAND_LOGO_SRC = '/logo.png'
/** Tab favicon — `frontend/public/favicon.png` */
export const BRAND_FAVICON_SRC = '/favicon.png'

const MARK_SRC = BRAND_LOGO_SRC

/** App mark (briefcase) + wordmark «Линия решения» */
export function AlfaLogo({
  to,
  compact = false,
  ink = false,
  markOnly = false,
}: AlfaLogoProps) {
  const href = to === false ? null : (to ?? '/')
  const size = compact ? 28 : 36

  const mark = (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ textDecoration: 'none' }}>
      <Box
        component="img"
        src={MARK_SRC}
        alt=""
        aria-hidden
        sx={{
          width: size,
          height: size,
          borderRadius: 1.25,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
      {!markOnly && (
        <Typography
          sx={{
            color: ink ? '#0B1F35' : '#fff',
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 700,
            fontSize: compact ? 15 : 17,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          Линия решения
        </Typography>
      )}
    </Stack>
  )

  if (!href) return mark

  return (
    <Box
      component={RouterLink}
      to={href}
      aria-label="Линия решения"
      sx={{ textDecoration: 'none', display: 'inline-flex', '&:hover': { opacity: 0.9 } }}
    >
      {mark}
    </Box>
  )
}

/** Sidebar / header mark without wordmark */
export function AlfaMark({ size = 32 }: { size?: number }) {
  return (
    <Box
      component="img"
      src={MARK_SRC}
      alt=""
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: 1.25,
        objectFit: 'cover',
        flexShrink: 0,
        display: 'block',
      }}
    />
  )
}
