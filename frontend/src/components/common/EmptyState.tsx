import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  /** Navigate (product screens). Prefer this in app flows. */
  actionTo?: string
  /** Local handler — no navigation (e.g. design-system demos). */
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, actionTo, onAction }: EmptyStateProps) {
  const showAction = Boolean(actionLabel && (actionTo || onAction))

  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.6)',
      }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 480, mx: 'auto' }}>
        {description}
      </Typography>
      {showAction && actionTo ? (
        <Button component={RouterLink} to={actionTo} variant="contained">
          {actionLabel}
        </Button>
      ) : null}
      {showAction && !actionTo && onAction ? (
        <Button type="button" variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  )
}
