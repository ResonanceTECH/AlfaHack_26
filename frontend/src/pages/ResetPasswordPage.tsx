import { Alert, Button, Stack } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordRequest } from '@/api/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordField } from '@/components/auth/PasswordField'
import { validatePasswordPair } from '@/utils/password'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const pwdErr = validatePasswordPair(password, password2)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    if (!token) {
      setError('В ссылке отсутствует токен')
      return
    }
    setLoading(true)
    try {
      await resetPasswordRequest(token, password, password2)
      setOk(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Новый пароль">
      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {ok ? <Alert severity="success">Пароль обновлён. Переходим ко входу…</Alert> : null}
        <PasswordField
          label="Новый пароль"
          value={password}
          onChange={setPassword}
          required
          fullWidth
          showStrengthHint
          autoComplete="new-password"
        />
        <PasswordField
          label="Повтор пароля"
          value={password2}
          onChange={setPassword2}
          required
          fullWidth
          autoComplete="new-password"
          error={Boolean(password2 && password !== password2)}
          helperText={password2 && password !== password2 ? 'Пароли не совпадают' : ' '}
        />
        <Button type="submit" variant="contained" disabled={loading || ok} sx={{ borderRadius: 2 }}>
          {loading ? 'Сохраняем…' : 'Сохранить пароль'}
        </Button>
      </Stack>
    </AuthShell>
  )
}
