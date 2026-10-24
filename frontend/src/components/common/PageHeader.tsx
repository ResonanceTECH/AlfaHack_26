import { Box, Breadcrumbs, Link as MuiLink, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Crumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, crumbs, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        {crumbs && crumbs.length > 0 && (
          <Breadcrumbs sx={{ mb: 0.5 }}>
            {crumbs.map((c) =>
              c.to ? (
                <MuiLink key={c.label} component={RouterLink} to={c.to} underline="hover" color="inherit">
                  {c.label}
                </MuiLink>
              ) : (
                <Typography key={c.label} color="text.primary" variant="body2">
                  {c.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        )}
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  )
}
