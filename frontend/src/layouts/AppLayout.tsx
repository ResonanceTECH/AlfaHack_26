import {
  Avatar,
  Badge,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import TopicRoundedIcon from '@mui/icons-material/TopicRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'
import { AlfaMark } from '@/components/landing/AlfaLogo'

const DRAWER_WIDTH = 260
const RAIL_WIDTH = 72
const COLLAPSE_KEY = 'alfa_nav_collapsed'

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean }
type NavGroup = { title: string; items: NavItem[] }

const iconSx = { fontSize: 22 }

const entrepreneurGroups: NavGroup[] = [
  {
    title: 'Бизнес',
    items: [
      { to: '/app', label: 'Главная', icon: <HomeRoundedIcon sx={iconSx} />, end: true },
      { to: '/app/company', label: 'Компания', icon: <ApartmentRoundedIcon sx={iconSx} /> },
      {
        to: '/app/statements',
        label: 'Финансовый профиль',
        icon: <AccountBalanceRoundedIcon sx={iconSx} />,
      },
    ],
  },
  {
    title: 'Подбор кредита',
    items: [
      { to: '/app/ai', label: 'AI-консультант', icon: <AutoAwesomeRoundedIcon sx={iconSx} /> },
      { to: '/app/recommendations', label: 'Подбор', icon: <TuneRoundedIcon sx={iconSx} /> },
      {
        to: '/app/scenarios',
        label: 'Сценарии и подбор',
        icon: <InsightsRoundedIcon sx={iconSx} />,
      },
    ],
  },
  {
    title: 'Заявки',
    items: [
      { to: '/app/applications', label: 'Мои заявки', icon: <AssignmentRoundedIcon sx={iconSx} /> },
      { to: '/app/documents', label: 'Документы', icon: <TopicRoundedIcon sx={iconSx} /> },
    ],
  },
  {
    title: 'Сервис',
    items: [
      {
        to: '/app/calendar',
        label: 'Календарь платежей',
        icon: <EventNoteRoundedIcon sx={iconSx} />,
      },
      { to: '/app/team', label: 'Команда', icon: <PeopleAltRoundedIcon sx={iconSx} /> },
      { to: '/app/help', label: 'Помощь', icon: <SupportAgentRoundedIcon sx={iconSx} /> },
    ],
  },
]

const managerGroups: NavGroup[] = [
  {
    title: 'Работа',
    items: [
      {
        to: '/app/manager',
        label: 'Очередь заявок',
        icon: <AssignmentRoundedIcon sx={iconSx} />,
      },
    ],
  },
]

function initials(name?: string): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}

function pageTitle(pathname: string): string {
  if (pathname === '/app/profile') return 'Профиль'
  if (pathname === '/app/company/inn-check') return 'Проверка ИНН'
  if (pathname === '/app/statements/upload') return 'Загрузка выписки'
  if (pathname === '/app/statements/analysis') return 'Анализ выписки'
  if (pathname === '/app/recommendations') return 'Подбор'
  if (pathname === '/app/recommendations/budget') return 'Бюджет цели'
  if (pathname === '/app/recommendations/results') return 'Результаты подбора'
  if (pathname === '/app/compare') return 'Сравнение кредитов'
  if (pathname === '/app/team/invite') return 'Пригласить сотрудника'
  if (pathname === '/app/team/tasks') return 'Совместные задачи'
  if (pathname.startsWith('/app/team/') && pathname !== '/app/team/invite') {
    return 'Участник'
  }
  if (pathname === '/app/notifications') return 'Уведомления'
  if (pathname === '/app/scenarios') return 'Сценарии и подбор'
  if (pathname === '/app/calculator') return 'Кредитный калькулятор'
  if (pathname === '/app/forecast') return 'Прогноз денежных средств'
  if (pathname === '/app/roi') return 'Окупаемость проекта'
  if (pathname === '/app/readiness') return 'Индекс готовности'
  if (pathname.endsWith('/edit') && pathname.startsWith('/app/applications/')) {
    return 'Редактирование заявки'
  }
  if (pathname.endsWith('/contract') && pathname.startsWith('/app/applications/')) {
    return 'Договор'
  }
  if (pathname.startsWith('/app/documents/') && pathname !== '/app/documents') {
    return 'Документ'
  }
  const flat = [...entrepreneurGroups, ...managerGroups].flatMap((g) => g.items)
  const exact = flat.find((i) => i.to === pathname)
  if (exact) return exact.label
  if (pathname === '/app' || pathname === '/app/') return 'Главная'
  return 'Кабинет'
}

export function AppLayout() {
  const { user, selectCompany } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const headerTitle = pageTitle(location.pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [companyAnchor, setCompanyAnchor] = useState<null | HTMLElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const rail = !isMobile && collapsed
  const navWidth = rail ? RAIL_WIDTH : DRAWER_WIDTH

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user) && user?.role !== 'manager',
  })

  const groups = useMemo(() => {
    if (!user) return []
    if (user.role === 'manager') return managerGroups
    if (user.role === 'accountant') {
      return entrepreneurGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) =>
            ['/app', '/app/company', '/app/statements', '/app/calendar', '/app/help'].includes(i.to),
          ),
        }))
        .filter((g) => g.items.length > 0)
    }
    return entrepreneurGroups
  }, [user])

  const activeCompany =
    companiesQ.data?.find((c) => c.id === user?.companyId) ?? companiesQ.data?.[0] ?? null

  function toggleCollapsed() {
    setCollapsed((v) => !v)
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#F7F8FA' }}>
      {/* Logo ↔ rail toggle */}
      <Box
        sx={{
          px: rail ? 0 : 1.5,
          pt: 1.75,
          pb: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: rail ? 'center' : 'space-between',
          gap: 0.5,
        }}
      >
        {rail ? (
          <Tooltip title="Развернуть меню" placement="right">
            <IconButton
              onClick={toggleCollapsed}
              aria-label="Развернуть меню"
              sx={{
                p: 0.75,
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(11,31,53,0.04)' },
              }}
            >
              <AlfaMark size={34} />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, pl: 0.5 }}>
              <AlfaMark size={32} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 15,
                    color: '#0B1F35',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  Линия решения
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#8A96A3', fontWeight: 600 }}>
                  Альфа‑Банк
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Свернуть в панель">
              <IconButton
                onClick={toggleCollapsed}
                size="small"
                aria-label="Свернуть меню"
                sx={{
                  color: '#5A6B7D',
                  borderRadius: 1.5,
                  border: '1px solid rgba(11,31,53,0.08)',
                  bgcolor: '#fff',
                  width: 32,
                  height: 32,
                  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.16)' },
                }}
              >
                <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: rail ? 0.75 : 1.25, pb: 1 }}>
        {groups.map((group) => (
          <Box key={group.title} sx={{ mb: rail ? 1 : 1.75 }}>
            {!rail && (
              <Typography
                sx={{
                  px: 1.25,
                  mb: 0.5,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#A0AAB4',
                }}
              >
                {group.title}
              </Typography>
            )}
            {rail && (
              <Box
                sx={{
                  height: 1,
                  bgcolor: 'rgba(11,31,53,0.06)',
                  mx: 1,
                  mb: 0.75,
                  mt: 0.25,
                }}
              />
            )}
            <List disablePadding>
              {group.items.map((item) => {
                const btn = (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    sx={{
                      borderRadius: 2,
                      py: rail ? 1.1 : 0.85,
                      px: rail ? 0 : 1.25,
                      mb: 0.2,
                      justifyContent: rail ? 'center' : 'flex-start',
                      color: '#5A6B7D',
                      minHeight: rail ? 44 : undefined,
                      '&.active': {
                        bgcolor: '#fff',
                        color: '#0B1F35',
                        boxShadow: '0 1px 4px rgba(11,31,53,0.06)',
                        '& .MuiListItemIcon-root': { color: '#EF3124' },
                      },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.7)' },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: rail ? 0 : 40,
                        color: 'inherit',
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!rail && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
                      />
                    )}
                  </ListItemButton>
                )
                return rail ? (
                  <Tooltip key={item.to} title={item.label} placement="right" enterDelay={300}>
                    <Box>{btn}</Box>
                  </Tooltip>
                ) : (
                  btn
                )
              })}
            </List>
          </Box>
        ))}
      </Box>

      {user?.role !== 'manager' && (
        <Box
          sx={{
            m: rail ? 1 : 1.5,
            p: rail ? 1 : 1.75,
            borderRadius: 2.5,
            bgcolor: '#fff',
            border: '1px solid rgba(11,31,53,0.06)',
            boxShadow: '0 2px 10px rgba(11,31,53,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: rail ? 'center' : 'stretch',
          }}
        >
          {rail ? (
            <Tooltip title="Иванова А.С. · Написать" placement="right">
              <IconButton
                onClick={() => navigate('/app/ai?new=manager')}
                sx={{
                  p: 0.5,
                  '&:hover': { bgcolor: 'rgba(239,49,36,0.06)' },
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'rgba(239,49,36,0.12)',
                    color: '#EF3124',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ИА
                </Avatar>
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Typography sx={{ fontSize: 11, color: '#8A96A3', fontWeight: 600, mb: 0.75 }}>
                Ваш менеджер
              </Typography>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'rgba(239,49,36,0.12)',
                    color: '#EF3124',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ИА
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35', lineHeight: 1.2 }}>
                    Иванова А.С.
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#8A96A3' }}>Персональный менеджер</Typography>
                </Box>
              </Stack>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={() => navigate('/app/ai?new=manager')}
                sx={{
                  borderRadius: 2,
                  borderColor: 'rgba(11,31,53,0.14)',
                  color: '#0B1F35',
                  fontWeight: 600,
                  fontSize: 12,
                  py: 0.85,
                }}
              >
                Написать менеджеру
              </Button>
            </>
          )}
        </Box>
      )}

      {rail && (
        <Box sx={{ pb: 1.5, display: 'grid', placeItems: 'center' }}>
          <Tooltip title="Развернуть меню" placement="right">
            <IconButton
              onClick={toggleCollapsed}
              size="small"
              aria-label="Развернуть меню"
              sx={{
                color: '#5A6B7D',
                border: '1px solid rgba(11,31,53,0.08)',
                bgcolor: '#fff',
                width: 32,
                height: 32,
              }}
            >
              <MenuOpenRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F3F5F8' }}>
      <Box
        component="nav"
        sx={{
          width: { md: navWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {isMobile ? (
          <Drawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
          >
            <Box sx={{ width: DRAWER_WIDTH, height: '100%' }}>{drawer}</Box>
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              width: navWidth,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: navWidth,
                boxSizing: 'border-box',
                borderRight: '1px solid rgba(11,31,53,0.06)',
                bgcolor: '#F7F8FA',
                overflowX: 'hidden',
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
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
          width: { md: `calc(100% - ${navWidth}px)` },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'rgba(243,245,248,0.92)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(11,31,53,0.05)',
            px: { xs: 2, md: 3 },
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} size="small">
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            sx={{
              flex: 1,
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: '#0B1F35',
              letterSpacing: '-0.01em',
              minWidth: 0,
            }}
            noWrap
          >
            {headerTitle}
          </Typography>

          <IconButton
            size="small"
            onClick={() => navigate('/app/notifications')}
            sx={{
              color: location.pathname === '/app/notifications' ? '#EF3124' : '#5A6B7D',
            }}
            aria-label="Уведомления"
          >
            <Badge badgeContent={4} color="error" overlap="circular">
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>

          {activeCompany && (
            <>
              <Button
                onClick={(e) => setCompanyAnchor(e.currentTarget)}
                endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
                startIcon={
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: '#EF3124',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                      lineHeight: 1,
                    }}
                  >
                    {(activeCompany.name.replace(/^ООО\s*[«"]?/i, '').trim()[0] ?? 'К').toUpperCase()}
                  </Box>
                }
                sx={{
                  maxWidth: 240,
                  borderRadius: 2,
                  px: 1.1,
                  py: 0.55,
                  bgcolor: '#fff',
                  border: '1px solid rgba(11,31,53,0.08)',
                  color: '#0B1F35',
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: 'none',
                  '& .MuiButton-startIcon': { mr: 0.75 },
                  '& .MuiButton-endIcon': { ml: 0.35 },
                }}
              >
                <Typography
                  noWrap
                  sx={{ fontSize: 13, fontWeight: 600, maxWidth: 150, textAlign: 'left' }}
                >
                  {activeCompany.name}
                </Typography>
              </Button>
              <Menu
                anchorEl={companyAnchor}
                open={Boolean(companyAnchor)}
                onClose={() => setCompanyAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {(companiesQ.data ?? []).map((c) => (
                  <MenuItem
                    key={c.id}
                    selected={c.id === user?.companyId}
                    onClick={() => {
                      selectCompany(c.id)
                      setCompanyAnchor(null)
                    }}
                  >
                    {c.name}
                  </MenuItem>
                ))}
                <MenuItem
                  onClick={() => {
                    setCompanyAnchor(null)
                    navigate('/select-company')
                  }}
                >
                  + Добавить компанию
                </MenuItem>
              </Menu>
            </>
          )}

          <Avatar
            onClick={() => navigate('/app/profile')}
            title="Профиль"
            sx={{
              width: 34,
              height: 34,
              bgcolor: '#0B1F35',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {initials(user?.fullName)}
          </Avatar>
        </Box>

        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
