import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface StatBlockProps {
  label: string
  value: ReactNode
  hint?: string
  accent?: boolean
}

export function StatBlock({ label, value, hint, accent }: StatBlockProps) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: accent ? 'rgba(239,49,36,0.06)' : 'rgba(11,31,53,0.03)',
        border: '1px solid',
        borderColor: accent ? 'rgba(239,49,36,0.2)' : 'divider',
        height: '100%',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}
