import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import { Box, Button, Container, IconButton, Link, Stack } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { AlfaLogo } from './AlfaLogo'

const NAV = [
  { label: 'Частным лицам', href: '#', active: false },
  { label: 'Малому бизнесу и ИП', href: '#', active: true },
  { label: 'Среднему и крупному', href: '#', active: false },
]

export function LandingHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        bgcolor: 'rgba(26,26,26,0.94)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 2.25 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={{ xs: 2, md: 3.5 }} sx={{ minWidth: 0, flex: 1 }}>
            <AlfaLogo />

            <Stack
              direction="row"
              spacing={{ md: 2, lg: 2.75 }}
              sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}
            >
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  underline="none"
                  sx={{
                    position: 'relative',
                    color: item.active ? '#fff' : 'rgba(255,255,255,0.72)',
                    fontSize: { md: 14, lg: 15 },
                    fontWeight: item.active ? 600 : 500,
                    whiteSpace: 'nowrap',
                    pb: 0.75,
                    '&::after': item.active
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 2,
                          bgcolor: '#EF3124',
                          borderRadius: 1,
                        }
                      : undefined,
                    '&:hover': { color: '#fff' },
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
            <IconButton
              aria-label="Поиск"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: 'rgba(255,255,255,0.75)',
                width: 40,
                height: 40,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <SearchRoundedIcon />
            </IconButton>
            <IconButton
              aria-label="Избранное"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: 'rgba(255,255,255,0.75)',
                width: 40,
                height: 40,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <StarBorderRoundedIcon />
            </IconButton>

            <Button
              component={RouterLink}
              to="/app/applications"
              variant="outlined"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.35)',
                borderRadius: 2,
                px: 2.5,
                py: 1.15,
                fontSize: 15,
                fontWeight: 600,
                ml: 0.5,
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              Онлайн‑заявки
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              color="primary"
              sx={{ borderRadius: 2, px: 3, py: 1.15, fontSize: 15, fontWeight: 700 }}
            >
              Войти
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
