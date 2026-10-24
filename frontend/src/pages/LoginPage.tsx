import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import { Box, Button, Link, Stack, TextField, Alert, InputAdornment, Typography } from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { AuthFooterLink, AuthShell } from '@/components/auth/AuthShell'
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/AuthMethodToggle'
import { OtpCodeForm } from '@/components/auth/OtpCodeForm'
import { PasswordField } from '@/components/auth/PasswordField'
import { PhoneField } from '@/components/auth/PhoneField'
import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail, normalizeEmail } from '@/utils/email'
import { toE164 } from '@/utils/phone'

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2 },
}

type Step = 'form' | 'otp'

export function LoginPage() {
  const { login, loginWithPhoneStart, loginWithPhoneVerify } = useAuth()
  const navigate = useNavigate()
  const [method, setMethod] = useState<AuthMethod>('email')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+7 ')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null)
  const [destinationMasked, setDestinationMasked] = useState<string | null>(null)
  const [resendAfter, setResendAfter] = useState(60)

  function goAfterAuth(user: { role: string; companyId?: string }) {
    if (user.role === 'manager' || user.role === 'risk_analyst') {
      navigate('/app/manager')
    } else if (!user.companyId) {
      navigate('/onboarding/company')
    } else {
      navigate('/app')
    }
  }

  async function startPhoneLogin() {
    setError(null)
    const e164 = toE164(phone)
    if (!e164) {
      setError('Укажите корректный телефон')
      return
    }
    setLoading(true)
    try {
      const res = await loginWithPhoneStart(e164)
      setChallengeId(res.challengeId)
      setDeliveryMode(res.deliveryMode ?? null)
      setDestinationMasked(res.destinationMasked ?? null)
      setResendAfter(res.resendAfter ?? 60)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  async function verifyPhone(code: string) {
    if (!challengeId) {
      setError('Сессия подтверждения устарела')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const user = await loginWithPhoneVerify(challengeId, code)
      goAfterAuth(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (method === 'phone') {
      await startPhoneLogin()
      return
    }
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
    <AuthShell
      title="Вход в Alfa Business Credit"
      footer={<AuthFooterLink prompt="Нет аккаунта?" to="/register" label="Зарегистрироваться" />}
    >
      {step === 'otp' ? (
        <OtpCodeForm
          destinationMasked={destinationMasked}
          deliveryMode={deliveryMode}
          resendAfter={resendAfter}
          loading={loading}
          error={error}
          onSubmit={verifyPhone}
          onResend={() => void startPhoneLogin()}
          onBack={() => {
            setStep('form')
            setError(null)
          }}
        />
      ) : (
        <form onSubmit={onSubmit} autoComplete="on">
          <AuthMethodToggle
            value={method}
            onChange={(v) => {
              setMethod(v)
              setError(null)
            }}
          />

          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            {method === 'phone' ? (
              <PhoneField value={phone} onChange={setPhone} required fullWidth sx={fieldSx} />
            ) : (
              <>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail((v) => normalizeEmail(v))}
                  fullWidth
                  required
                  autoComplete="username"
                  inputProps={{ inputMode: 'email', maxLength: 255 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
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
                <Typography variant="body2" sx={{ textAlign: 'right', mt: -1 }}>
                  <Link component={RouterLink} to="/forgot-password" underline="hover">
                    Забыли пароль?
                  </Link>
                </Typography>
              </>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 15 }}
            >
              {loading ? 'Отправляем…' : method === 'phone' ? 'Получить код' : 'Войти'}
            </Button>

            <Button
              type="button"
              variant="outlined"
              size="large"
              disabled
              title="Официальный OAuth Альфа-Бизнес недоступен в этой сборке"
              sx={{
                py: 1.25,
                borderRadius: 2,
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 600,
                gap: 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: '#fff',
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                A
              </Box>
              Войти через Альфа-Бизнес (скоро)
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
