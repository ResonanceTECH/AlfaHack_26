import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthFooterLink, AuthShell } from '@/components/auth/AuthShell'
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/AuthMethodToggle'
import { OtpCodeForm } from '@/components/auth/OtpCodeForm'
import { PasswordField } from '@/components/auth/PasswordField'
import { PhoneField } from '@/components/auth/PhoneField'
import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail, normalizeEmail } from '@/utils/email'
import { validatePasswordPair } from '@/utils/password'
import { formatRuPhoneMask, isPhoneEmpty, isValidRuMobile, toE164 } from '@/utils/phone'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
  },
}

type Step = 'form' | 'otp' | 'email_sent'

export function RegisterPage() {
  const { registerWithPhoneStart, registerWithPhoneVerify, registerWithEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const phoneFromLanding =
    typeof (location.state as { phone?: string } | null)?.phone === 'string'
      ? formatRuPhoneMask((location.state as { phone: string }).phone)
      : '+7 '

  const [method, setMethod] = useState<AuthMethod>('phone')
  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState(phoneFromLanding)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null)
  const [destinationMasked, setDestinationMasked] = useState<string | null>(null)
  const [resendAfter, setResendAfter] = useState(60)
  const [emailMasked, setEmailMasked] = useState<string | null>(null)

  function goAfterAuth(user: { role: string; companyId?: string }) {
    if (user.role === 'manager' || user.role === 'risk_analyst') {
      navigate('/app/manager')
    } else {
      navigate('/onboarding/company')
    }
  }

  async function startPhone() {
    setError(null)
    if (!agree) {
      setError('Нужно согласие с условиями обработки данных')
      return
    }
    if (!fullName.trim()) {
      setError('Укажите ФИО')
      return
    }
    const e164 = toE164(phone)
    if (!e164) {
      setError('Укажите телефон в формате +7 (999) 999-99-99')
      return
    }
    if (email.trim() && !isValidEmail(email)) {
      setError('Укажите корректный email или оставьте поле пустым')
      return
    }
    setLoading(true)
    try {
      const res = await registerWithPhoneStart({
        fullName: fullName.trim().replace(/\s+/g, ' '),
        phone: e164,
        email: email.trim() ? normalizeEmail(email) : undefined,
        consent: true,
      })
      setChallengeId(res.challengeId)
      setDeliveryMode(res.deliveryMode ?? null)
      setDestinationMasked(res.destinationMasked ?? null)
      setResendAfter(res.resendAfter ?? 60)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  async function verifyPhone(code: string) {
    if (!challengeId) {
      setError('Сессия подтверждения устарела — начните снова')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const user = await registerWithPhoneVerify(challengeId, code)
      goAfterAuth(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  async function submitEmail() {
    setError(null)
    if (!agree) {
      setError('Нужно согласие с условиями обработки данных')
      return
    }
    if (!fullName.trim()) {
      setError('Укажите ФИО')
      return
    }
    if (!isValidEmail(email)) {
      setError('Укажите корректный email')
      return
    }
    const pwdErr = validatePasswordPair(password, password2)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    if (!isPhoneEmpty(phone) && !isValidRuMobile(phone)) {
      setError('Некорректный телефон')
      return
    }
    setLoading(true)
    try {
      const res = await registerWithEmail({
        fullName: fullName.trim().replace(/\s+/g, ' '),
        email: normalizeEmail(email),
        password,
        passwordConfirm: password2,
        phone: toE164(phone) ?? undefined,
        consent: true,
      })
      setEmailMasked(res.emailMasked ?? normalizeEmail(email))
      setDeliveryMode(res.deliveryMode ?? null)
      setStep('email_sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (method === 'phone') await startPhone()
    else await submitEmail()
  }

  return (
    <AuthShell
      title="Регистрация в Alfa Business Credit"
      footer={<AuthFooterLink prompt="Уже есть аккаунт?" to="/login" label="Войти" />}
    >
      {step === 'otp' ? (
        <OtpCodeForm
          destinationMasked={destinationMasked}
          deliveryMode={deliveryMode}
          resendAfter={resendAfter}
          loading={loading}
          error={error}
          onSubmit={verifyPhone}
          onResend={() => void startPhone()}
          onBack={() => {
            setStep('form')
            setError(null)
          }}
        />
      ) : null}

      {step === 'email_sent' ? (
        <Stack spacing={2}>
          <Alert severity="success">
            Мы отправили письмо на {emailMasked}. Откройте ссылку для подтверждения email.
          </Alert>
          {deliveryMode === 'console' ? (
            <Alert severity="info">
              Режим разработки (EMAIL_PROVIDER=console): письмо не уходит через SMTP — смотрите логи
              API.
            </Alert>
          ) : null}
          <Button variant="contained" onClick={() => navigate('/login')} sx={{ borderRadius: 2 }}>
            Перейти ко входу
          </Button>
        </Stack>
      ) : null}

      {step === 'form' ? (
        <form onSubmit={onSubmit} autoComplete="on">
          <AuthMethodToggle
            value={method}
            onChange={(v) => {
              setMethod(v)
              setError(null)
            }}
          />

          <Stack spacing={1.75}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="ФИО"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setFullName((v) => v.trim().replace(/\s+/g, ' '))}
              required
              fullWidth
              autoComplete="name"
              inputProps={{ maxLength: 255 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />

            {method === 'phone' ? (
              <>
                <PhoneField
                  value={phone}
                  onChange={setPhone}
                  required
                  fullWidth
                  sx={fieldSx}
                />
                <TextField
                  label="Email (необязательно)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail((v) => (v.trim() ? normalizeEmail(v) : ''))}
                  fullWidth
                  autoComplete="email"
                  inputProps={{ inputMode: 'email', maxLength: 255 }}
                  sx={fieldSx}
                />
              </>
            ) : (
              <>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail((v) => normalizeEmail(v))}
                  required
                  fullWidth
                  autoComplete="email"
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
                <PhoneField
                  label="Телефон (необязательно)"
                  value={phone}
                  onChange={setPhone}
                  fullWidth
                  sx={fieldSx}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <PasswordField
                    label="Пароль"
                    value={password}
                    onChange={setPassword}
                    required
                    fullWidth
                    showStrengthHint
                    autoComplete="new-password"
                    sx={fieldSx}
                  />
                  <PasswordField
                    label="Повтор пароля"
                    value={password2}
                    onChange={setPassword2}
                    required
                    fullWidth
                    autoComplete="new-password"
                    helperText={
                      password2 && password !== password2 ? 'Пароли не совпадают' : ' '
                    }
                    error={Boolean(password2 && password !== password2)}
                    sx={fieldSx}
                  />
                </Stack>
              </>
            )}

            <FormControlLabel
              control={
                <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} color="primary" />
              }
              label={
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                  Согласен на обработку персональных данных и условия сервиса
                </Typography>
              }
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 15 }}
            >
              {loading ? 'Отправляем…' : method === 'phone' ? 'Получить код' : 'Зарегистрироваться'}
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
      ) : null}
    </AuthShell>
  )
}
