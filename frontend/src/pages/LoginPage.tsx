import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import { Button, Link, Stack, TextField, Alert, InputAdornment } from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordField } from '@/components/auth/PasswordField'
import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail, normalizeEmail } from '@/utils/email'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#D8DEE6' },
    '&:hover fieldset': { borderColor: '#B8C0CC' },
    '&.Mui-focused fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
  },
  '& .MuiInputLabel-root': {
    color: '#8A94A6',
    fontSize: 14,
  },
  '& .MuiInputBase-input': {
    py: 1.55,
    fontSize: 15,
  },
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function goAfterAuth(user: { role: string; companyId?: string }) {
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      navigate(next)
      return
    }
    if (user.role === 'manager' || user.role === 'risk_analyst') {
      navigate('/app/manager')
    } else if (user.companyId) {
      navigate('/app')
    } else {
      navigate('/select-company')
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) {
      setError('Укажите корректный email')
      return
    }
    if (!password) {
      setError('Введите пароль')
      return
    }
    setLoading(true)
    try {
      const user = await login(normalizeEmail(email), password)
      goAfterAuth(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Вход в личный кабинет">
      <form onSubmit={onSubmit} autoComplete="on">
        <Stack spacing={2.25}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmail((v) => normalizeEmail(v))}
            placeholder="name@company.ru"
            fullWidth
            required
            autoComplete="username"
            inputProps={{ inputMode: 'email', maxLength: 255 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon sx={{ fontSize: 20, color: '#8A94A6' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />

          <PasswordField
            label="Пароль"
            value={password}
            onChange={setPassword}
            fullWidth
            required
            autoComplete="current-password"
            sx={fieldSx}
          />

          <Link
            component={RouterLink}
            to="/forgot-password"
            underline="hover"
            sx={{
              alignSelf: 'flex-end',
              mt: -0.75,
              color: '#EF3124',
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            Забыли пароль?
          </Link>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            disableElevation
            sx={{
              mt: 0.5,
              py: 1.55,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              bgcolor: '#EF3124',
              textTransform: 'none',
              '&:hover': { bgcolor: '#D4251A' },
            }}
          >
            {loading ? 'Входим…' : 'Войти'}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
