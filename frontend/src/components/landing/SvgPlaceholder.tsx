import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

type SvgPlaceholderProps = {
  label: string
  tone?: 'dark' | 'light'
  width?: number | string
  height?: number | string
  sx?: SxProps<Theme>
}

/** Temporary stand-in until real SVGs are dropped into assets/landing */
export function SvgPlaceholder({
  label,
  tone = 'dark',
  width = '100%',
  height = '100%',
  sx,
}: SvgPlaceholderProps) {
  const onDark = tone === 'dark'
  return (
    <Box
      aria-hidden
      sx={[
        {
          width,
          height,
          minHeight: typeof height === 'number' ? height : 80,
          borderRadius: 2,
          border: onDark
            ? '1.5px dashed rgba(255,255,255,0.28)'
            : '1.5px dashed rgba(11,31,53,0.2)',
          bgcolor: onDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
          display: 'grid',
          placeItems: 'center',
          px: 1.5,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: onDark ? 'rgba(255,255,255,0.55)' : 'rgba(11,31,53,0.4)',
          textAlign: 'center',
          wordBreak: 'break-all',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

export function LandingIllustration({
  src,
  label,
  alt = '',
  tone = 'dark',
  sx,
}: {
  src: string | null
  label: string
  alt?: string
  tone?: 'dark' | 'light'
  sx?: SxProps<Theme>
}) {
  if (src) {
    return (
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={[{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      />
    )
  }
  return <SvgPlaceholder label={label} tone={tone} sx={sx} />
}
