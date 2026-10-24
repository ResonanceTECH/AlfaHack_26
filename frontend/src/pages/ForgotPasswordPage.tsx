import { Alert, Button, Stack, TextField } from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { forgotPasswordRequest } from '@/api/auth'
import { AuthFooterLink, AuthShell } from '@/components/auth/AuthShell'
import { isValidEmail, normalizeEmail } from '@/utils/email'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) {
      setError('Укажите корректный email')
      return
    }
    setLoading(true)
    try {
      const res = await forgotPasswordRequest(normalizeEmail(email))
      setMessage(res.message)
      setDeliveryMode(res.deliveryMode ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Восстановление пароля"
      footer={<AuthFooterLink prompt="Вспомнили пароль?" to="/login" label="Войти" />}
    >
      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {message ? <Alert severity="success">{message}</Alert> : null}
        {deliveryMode === 'console' ? (
          <Alert severity="info">
            Dev-режим: письмо не уходит по SMTP (EMAIL_PROVIDER=console).
          </Alert>
        ) : null}
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
        />
        <Button type="submit" variant="contained" disabled={loading} sx={{ borderRadius: 2, py: 1.3 }}>
          {loading ? 'Отправляем…' : 'Отправить ссылку'}
        </Button>
        <Button component={RouterLink} to="/login" variant="text">
          Назад
        </Button>
      </Stack>
    </AuthShell>
  )
}
