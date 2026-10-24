import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
}

export function EmptyState({ title, description, actionLabel, actionTo }: EmptyStateProps) {
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
      {actionLabel && actionTo && (
        <Button component={RouterLink} to={actionTo} variant="contained">
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
