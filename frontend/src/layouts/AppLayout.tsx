import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  AppBar,
  Typography,
  Button,
  Chip,
  useMediaQuery,
  useTheme,
  Divider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined'
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { roleLabels } from '@/data/labels'

const DRAWER_WIDTH = 268

type NavItem = { to: string; label: string; icon: ReactNode; roles?: string[] }

const entrepreneurNav: NavItem[] = [
  { to: '/app', label: 'Обзор', icon: <DashboardOutlinedIcon /> },
  { to: '/app/company', label: 'Профиль компании', icon: <BusinessOutlinedIcon /> },
  { to: '/app/goals', label: 'Зачем кредит', icon: <FlagOutlinedIcon /> },
  { to: '/app/ai', label: 'AI-консультант', icon: <SmartToyOutlinedIcon /> },
  { to: '/app/recommendations', label: 'Подбор кредитов', icon: <RecommendOutlinedIcon /> },
  { to: '/app/compare', label: 'Сравнение', icon: <CompareArrowsOutlinedIcon /> },
  { to: '/app/calculator', label: 'Калькулятор', icon: <CalculateOutlinedIcon /> },
  { to: '/app/applications', label: 'Заявки', icon: <DescriptionOutlinedIcon /> },
  { to: '/app/statements', label: 'Выписка', icon: <AccountBalanceOutlinedIcon /> },
  { to: '/app/forecast', label: 'Прогноз cash flow', icon: <ShowChartOutlinedIcon /> },
  { to: '/app/scenarios', label: 'Scenario Lab', icon: <ScienceOutlinedIcon /> },
  { to: '/app/readiness', label: 'Готовность', icon: <FactCheckOutlinedIcon /> },
  { to: '/app/roi', label: 'Окупаемость', icon: <TrendingUpOutlinedIcon /> },
  { to: '/app/calendar', label: 'Календарь', icon: <CalendarMonthOutlinedIcon /> },
]

const managerNav: NavItem[] = [
  { to: '/app/manager', label: 'Очередь заявок', icon: <SupportAgentOutlinedIcon /> },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = useState(false)

  const items = useMemo(() => {
    if (!user) return []
    if (user.role === 'manager') return managerNav
    if (user.role === 'accountant') {
      return entrepreneurNav.filter((i) =>
        ['/app', '/app/company', '/app/statements', '/app/forecast', '/app/calendar', '/app/roi'].includes(i.to),
      )
    }
    return entrepreneurNav
  }, [user])

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5, px: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          A
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, lineHeight: 1.1 }}>
            Alfa Credit
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Business
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1.5, flex: 1, overflow: 'auto' }}>
        {items.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.to === '/app'}
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 1.5,
              mb: 0.25,
              '&.active': {
                bgcolor: 'rgba(239,49,36,0.08)',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 550 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {user?.fullName}
        </Typography>
        <Chip size="small" label={user ? roleLabels[user.role] : ''} sx={{ mt: 0.5, mb: 1 }} />
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Выйти
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
            {isMobile ? 'Alfa Credit' : 'Кабинет'}
          </Typography>
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label="MVP demo · не оферта банка"
          />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }}>
            <Box sx={{ width: DRAWER_WIDTH }}>{drawer}</Box>
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'rgba(255,255,255,0.92)',
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          p: { xs: 2, md: 3 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
