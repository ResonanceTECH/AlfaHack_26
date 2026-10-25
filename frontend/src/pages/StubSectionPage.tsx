import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'

const copy: Record<string, { title: string; body: string }> = {
  '/app/documents': {
    title: 'Документы',
    body: 'Здесь появятся документы по заявкам и проверкам реестра.',
  },
}

export function StubSectionPage() {
  const { pathname } = useLocation()
  const meta = copy[pathname] ?? { title: 'Раздел', body: 'Раздел в разработке.' }

  return (
    <Box
      sx={{
        maxWidth: 560,
        bgcolor: '#fff',
        borderRadius: 3,
        border: '1px solid rgba(11,31,53,0.06)',
        p: 3,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: 22,
          color: '#0B1F35',
          mb: 1,
        }}
      >
        {meta.title}
      </Typography>
      <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.5, mb: 2.5 }}>
        {meta.body}
      </Typography>
      <Button component={RouterLink} to="/app" variant="contained" color="primary" sx={{ fontWeight: 700 }}>
        На главную
      </Button>
    </Box>
  )
}
