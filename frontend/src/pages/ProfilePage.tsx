import {
  Avatar,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'
import { LogoutConfirmDialog } from '@/components/common/LogoutConfirmDialog'
import { isAnalystRole } from '@/features/analyst/roles'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.5 },
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
  },
  '& .MuiInputLabel-root': { color: '#8A96A3' },
} as const

const outlineBtn = {
  borderRadius: 2,
  borderColor: 'rgba(11,31,53,0.14)',
  color: '#0B1F35',
  fontWeight: 600,
  fontSize: 13.5,
  bgcolor: '#fff',
  textTransform: 'none' as const,
  px: 2,
  py: 0.9,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
}

function initials(name?: string): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}

type Session = {
  id: string
  device: string
  place: string
  current?: boolean
}

const DEMO_SESSIONS: Session[] = [
  { id: 's1', device: 'MacBook · Chrome', place: 'Москва · сейчас', current: true },
  { id: 's2', device: 'iPhone · приложение', place: 'Москва · 22.10 18:20' },
  { id: 's3', device: 'Windows · Edge', place: 'Москва · 19.10 09:44' },
]

function defaultsForRole(role?: string) {
  if (role === 'admin') {
    return {
      fullName: 'Елена Васильева',
      phone: '+7 (495) 755-58-58',
      email: 'admin@demo.alfa',
      position: 'Администратор',
    }
  }
  if (isAnalystRole(role)) {
    return {
      fullName: 'Анна Соколова',
      phone: '+7 (495) 788-88-78',
      email: 'analyst@demo.alfa',
      position: 'Аналитик',
    }
  }
  return {
    fullName: 'Миронов Сергей Павлович',
    phone: '+7 (916) 482-14-20',
    email: 'sergey.mironov@kofeplus.demo',
    position: 'Генеральный директор',
  }
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const isBank = isAnalystRole(user?.role)
  const defaults = defaultsForRole(user?.role)

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user) && !isAdmin && !isBank,
  })

  const company =
    companiesQ.data?.find((c) => c.id === user?.companyId) ?? companiesQ.data?.[0] ?? null

  const membershipLabel =
    company?.membershipRole === 'OWNER'
      ? 'владелец'
      : company?.membershipRole === 'VIEWER'
        ? 'наблюдатель'
        : 'участник'

  const [fullName, setFullName] = useState(() => user?.fullName || defaults.fullName)
  const [phone, setPhone] = useState(() => user?.phone || defaults.phone)
  const [email, setEmail] = useState(() => user?.email || defaults.email)
  const [language, setLanguage] = useState('ru')
  const [position, setPosition] = useState(defaults.position)
  const [department, setDepartment] = useState(
    isAdmin ? 'Администрирование платформы' : isBank ? 'Малый и средний бизнес · кредиты' : '',
  )
  const [desk, setDesk] = useState('МСБ · оборотные / инвестиционные')
  const [limit, setLimit] = useState('до 20 млн ₽')
  const [savedFlash, setSavedFlash] = useState(false)

  const [twoFa, setTwoFa] = useState(true)
  const [biometry, setBiometry] = useState(false)
  const [notifyDevice, setNotifyDevice] = useState(true)
  const [sessions, setSessions] = useState(() =>
    isBank
      ? [
          { id: 's1', device: 'MacBook · Chrome · кабинет аналитика', place: 'Москва · сейчас', current: true },
          { id: 's2', device: 'iPhone · web', place: 'Москва · 25.10 12:10' },
        ]
      : isAdmin
        ? [
            { id: 's1', device: 'MacBook · Chrome · админ-консоль', place: 'Москва · сейчас', current: true },
            { id: 's2', device: 'Windows · Edge', place: 'Москва · 24.10 19:02' },
          ]
        : DEMO_SESSIONS,
  )
  const [logoutOpen, setLogoutOpen] = useState(false)

  // Если роль банк/админ — не оставляем предпринимательские дефолты («Генеральный директор» и т.п.)
  useEffect(() => {
    if (!user) return
    const d = defaultsForRole(user.role)
    if (user.fullName) setFullName(user.fullName)
    if (user.email) setEmail(user.email)
    if (user.phone) setPhone(user.phone)
    if (isAnalystRole(user.role) || user.role === 'admin') {
      setPosition(d.position)
      setDepartment(
        user.role === 'admin' ? 'Администрирование платформы' : 'Малый и средний бизнес · кредиты',
      )
    }
  }, [user?.id, user?.role, user?.fullName, user?.email, user?.phone])

  const subtitle = useMemo(() => {
    const name = fullName.trim() || 'Пользователь'
    if (isAdmin) return `${name} · Администратор системы · RBAC ADMIN`
    if (isBank) return `${name} · Аналитик · единый кабинет · ANALYST`
    const companyPart = company?.name ? `${membershipLabel} ${company.name}` : null
    return companyPart ? `${name} · ${companyPart}` : name
  }, [fullName, company?.name, membershipLabel, isAdmin, isBank])

  const stayPath = isAdmin ? '/app/admin' : isBank ? '/app/analyst' : '/app'

  function doLogout() {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  function saveProfile() {
    const next = {
      ...user!,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    }
    localStorage.setItem('alfa_user', JSON.stringify(next))
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
  }

  function killSession(id: string) {
    setSessions((list) => list.filter((s) => s.id !== id))
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Профиль пользователя
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>{subtitle}</Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => setLogoutOpen(true)}
          sx={{ ...outlineBtn, alignSelf: 'flex-start' }}
        >
          Выйти
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        {/* ——— Left ——— */}
        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 2,
              }}
            >
              Личные данные
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' },
                alignItems: 'start',
              }}
            >
              <Stack alignItems="center" spacing={1} sx={{ pt: 0.5 }}>
                <Avatar
                  sx={{
                    width: 88,
                    height: 88,
                    bgcolor: '#0B1F35',
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {initials(fullName)}
                </Avatar>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ ...outlineBtn, fontSize: 12, py: 0.45, px: 1.5 }}
                  onClick={() => undefined}
                >
                  Изменить
                </Button>
              </Stack>

              <Box>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  }}
                >
                  <TextField
                    label="ФИО"
                    fullWidth
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    sx={{ ...fieldSx, gridColumn: { sm: '1 / -1' } }}
                  />
                  <TextField
                    label="Телефон"
                    fullWidth
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="E-mail"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    select
                    label="Язык"
                    fullWidth
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    sx={fieldSx}
                  >
                    <MenuItem value="ru">Русский</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </TextField>
                  <TextField
                    label="Должность"
                    fullWidth
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    sx={fieldSx}
                    helperText={
                      isAdmin
                        ? 'Роль системы: ADMIN'
                        : isBank
                          ? 'Роль системы: ANALYST · write decision'
                          : undefined
                    }
                  />
                  {(isAdmin || isBank) && (
                    <TextField
                      label="Подразделение"
                      fullWidth
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      sx={fieldSx}
                    />
                  )}
                  {isBank && (
                    <>
                      <TextField
                        label="Рабочий стол"
                        fullWidth
                        value={desk}
                        onChange={(e) => setDesk(e.target.value)}
                        sx={fieldSx}
                      />
                      <TextField
                        label="Лимит согласования"
                        fullWidth
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        sx={fieldSx}
                      />
                    </>
                  )}
                </Box>

                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
                  {savedFlash && (
                    <Typography sx={{ fontSize: 13, color: '#1B8A5A', fontWeight: 600 }}>
                      Сохранено
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={saveProfile}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      px: 2.5,
                      py: 1,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': { boxShadow: 'none' },
                    }}
                  >
                    Сохранить
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              Безопасность
            </Typography>

            <Stack spacing={0}>
              <ToggleRow
                label="Двухфакторная аутентификация (SMS)"
                checked={twoFa}
                onChange={setTwoFa}
              />
              <ToggleRow
                label="Вход по биометрии на устройстве (демо)"
                checked={biometry}
                onChange={setBiometry}
              />
              <ToggleRow
                label="Уведомлять о новом устройстве"
                checked={notifyDevice}
                onChange={setNotifyDevice}
              />
            </Stack>

            <Box
              sx={{
                mt: 1.5,
                pt: 1.75,
                borderTop: '1px solid rgba(11,31,53,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ fontSize: 13.5, color: '#5A6B7D' }}>
                Пароль изменён 12.08.2026
              </Typography>
              <Button
                variant="outlined"
                sx={outlineBtn}
                onClick={() => navigate('/forgot-password')}
              >
                Сменить пароль
              </Button>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              sx={{ ...outlineBtn, mt: 2, py: 1.05 }}
              onClick={doLogout}
            >
              Выйти на всех устройствах
            </Button>
          </Box>
        </Stack>

        {/* ——— Right ——— */}
        <Stack spacing={2}>
          {isBank && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.25,
                }}
              >
                Доступ аналитика
              </Typography>
              <Stack spacing={1.1}>
                {[
                  ['Политика', 'CP-2026.10'],
                  ['RBAC', 'ANALYST · write decision'],
                  ['Очередь', 'назначенные + unassigned'],
                  ['Кабинет', '/app/analyst'],
                ].map(([k, v]) => (
                  <Stack key={k} direction="row" justifyContent="space-between" spacing={1.5}>
                    <Typography sx={{ fontSize: 13, color: '#8A96A3' }}>{k}</Typography>
                    <Typography
                      sx={{ fontSize: 13, fontWeight: 650, color: '#0B1F35', textAlign: 'right' }}
                    >
                      {v}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.5,
              }}
            >
              Активные сеансы
            </Typography>
            <Stack spacing={0}>
              {sessions.map((s, i) => (
                <Stack
                  key={s.id}
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{
                    py: 1.25,
                    borderBottom:
                      i < sessions.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', lineHeight: 1.3 }}
                    >
                      {s.device}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.3 }}>
                      {s.place}
                    </Typography>
                  </Box>
                  {s.current ? (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: '#E6F5EE',
                        color: '#1B8A5A',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Это устройство
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      onClick={() => killSession(s.id)}
                      sx={{
                        color: '#EF3124',
                        fontWeight: 700,
                        fontSize: 12.5,
                        textTransform: 'none',
                        minWidth: 0,
                        px: 0.5,
                        flexShrink: 0,
                        '&:hover': { bgcolor: 'rgba(239,49,36,0.06)' },
                      }}
                    >
                      Завершить
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1,
              }}
            >
              Выход из аккаунта
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#7A8795', lineHeight: 1.45, mb: 2 }}>
              {isAdmin
                ? 'Сессия администратора на этом устройстве будет завершена. Доступ к консоли и аудиту закроется до повторного входа.'
                : isBank
                  ? 'Сессия аналитика будет завершена. Открытые карточки заявок сохранят статус на сервере.'
                  : 'Несохранённые данные заявок сохранятся как черновик. Сессия на этом устройстве будет завершена.'}
            </Typography>
            <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }}>
              <Button
                variant="contained"
                onClick={() => setLogoutOpen(true)}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#0B1F35',
                  px: 2.5,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#162A42', boxShadow: 'none' },
                }}
              >
                Выйти
              </Button>
              <Button variant="outlined" sx={outlineBtn} onClick={() => navigate(stayPath)}>
                Остаться
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>
              Перед выходом спросим подтверждение
            </Typography>
          </Box>
        </Stack>
      </Box>

      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={doLogout}
      />
    </Box>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <FormControlLabel
      control={
        <Switch
          checked={checked}
          onChange={(_, v) => onChange(v)}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: '#1B8A5A' },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              bgcolor: '#1B8A5A',
              opacity: 0.45,
            },
          }}
        />
      }
      label={label}
      labelPlacement="start"
      sx={{
        m: 0,
        py: 1.05,
        width: '100%',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(11,31,53,0.06)',
        '& .MuiFormControlLabel-label': {
          fontSize: 13.5,
          fontWeight: 600,
          color: '#0B1F35',
          pr: 2,
        },
      }}
    />
  )
}
