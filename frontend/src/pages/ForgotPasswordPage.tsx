import CheckIcon from '@mui/icons-material/Check'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Link,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { forgotPasswordRequest } from '@/api/auth'
import { AuthFooterLink, AuthShell } from '@/components/auth/AuthShell'
import { LinkExpiryTimer } from '@/components/auth/LinkExpiryTimer'
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

const pillBtnSx = {
  py: 1.55,
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: '-0.01em',
  bgcolor: '#EF3124',
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#D4251A' },
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timerKey, setTimerKey] = useState(0)

  async function sendLink() {
    setError(null)
    if (!isValidEmail(email)) {
      setError('Укажите корректный email')
      return
    }
    const normalized = normalizeEmail(email)
    setLoading(true)
    try {
      const res = await forgotPasswordRequest(normalized)
      setEmail(normalized)
      setSentTo(normalized)
      setDeliveryMode(res.deliveryMode ?? null)
      setTimerKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await sendLink()
  }

  if (sentTo) {
    return (
      <AuthShell
        title="Проверьте почту"
        beforeTitle={
          <Box
            aria-hidden
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: '#E6F6EE',
              color: '#1B8A5A',
              display: 'grid',
              placeItems: 'center',
              mx: 'auto',
            }}
          >
            <CheckIcon sx={{ fontSize: 28 }} />
          </Box>
        }
        subtitle={
          <>
            Если аккаунт существует, мы отправили письмо на{' '}
            <Box component="span" sx={{ color: '#0B1F35', fontWeight: 600 }}>
              {sentTo}
            </Box>
          </>
        }
      >
        <Stack spacing={2}>
          <LinkExpiryTimer active resetKey={timerKey} />

          {deliveryMode === 'console' ? (
            <Alert severity="info">
              Dev-режим: письмо не уходит по SMTP (EMAIL_PROVIDER=console).
            </Alert>
          ) : null}

          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            size="large"
            disableElevation
            fullWidth
            sx={pillBtnSx}
          >
            Вернуться ко входу
          </Button>

          <Link
            component="button"
            type="button"
            underline="hover"
            disabled={loading}
            onClick={() => void sendLink()}
            sx={{
              alignSelf: 'flex-start',
              color: '#EF3124',
              fontWeight: 700,
              fontSize: 14,
              border: 0,
              background: 'none',
              cursor: loading ? 'default' : 'pointer',
              p: 0,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Отправляем…' : 'Отправить ещё раз'}
          </Link>
        </Stack>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Восстановление пароля"
      subtitle="Укажите email — отправим ссылку для сброса"
      footer={<AuthFooterLink prompt="Вспомнили пароль?" to="/login" label="Войти" />}
    >
      <Stack component="form" spacing={2.25} onSubmit={onSubmit}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmail((v) => normalizeEmail(v))}
          placeholder="name@company.ru"
          required
          fullWidth
          autoComplete="email"
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

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          disableElevation
          fullWidth
          sx={pillBtnSx}
        >
          {loading ? 'Отправляем…' : 'Отправить ссылку'}
        </Button>

        <LinkExpiryTimer active={false} />
      </Stack>
    </AuthShell>
  )
}
