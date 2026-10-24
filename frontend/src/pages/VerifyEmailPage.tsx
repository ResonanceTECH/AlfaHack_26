import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyEmailToken } from '@/api/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/contexts/AuthContext'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromSession } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setError('В ссылке отсутствует токен подтверждения')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const session = await verifyEmailToken(token)
        if (cancelled) return
        setUserFromSession(session.user)
        setDone(true)
        navigate('/select-company', { replace: true })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ссылка недействительна или устарела')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, navigate, setUserFromSession])

  return (
    <AuthShell title="Подтверждение email">
      <Stack spacing={2} alignItems="flex-start">
        {error ? (
          <>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={() => navigate('/login')}>
              Ко входу
            </Button>
          </>
        ) : done ? (
          <Typography>Email подтверждён, перенаправляем…</Typography>
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} />
            <Typography>Проверяем ссылку…</Typography>
          </Stack>
        )}
      </Stack>
    </AuthShell>
  )
}
