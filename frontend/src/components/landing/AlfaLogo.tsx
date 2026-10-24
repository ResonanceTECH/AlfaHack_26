import { Box, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

type AlfaLogoProps = {
  to?: string
  compact?: boolean
}

/** Red square + white A — classic Alfa mark */
export function AlfaLogo({ to = '/', compact = false }: AlfaLogoProps) {
  const mark = (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ textDecoration: 'none' }}>
      <Box
        aria-hidden
        sx={{
          width: compact ? 28 : 36,
          height: compact ? 28 : 36,
          borderRadius: 1.25,
          bgcolor: '#EF3124',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Box
          component="span"
          sx={{
            color: '#fff',
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: compact ? 16 : 20,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            borderBottom: '2px solid #fff',
            pb: '1px',
          }}
        >
          A
        </Box>
      </Box>
      <Typography
        sx={{
          color: '#fff',
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          fontSize: compact ? 15 : 17,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}
      >
        Альфа‑Банк
      </Typography>
    </Stack>
  )

  if (!to) return mark

  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{ textDecoration: 'none', display: 'inline-flex', '&:hover': { opacity: 0.9 } }}
    >
      {mark}
    </Box>
  )
}
