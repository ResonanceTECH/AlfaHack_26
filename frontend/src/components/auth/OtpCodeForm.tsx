import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { isCompleteOtp, normalizeOtpCode } from '@/utils/otp'

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' },
  '& input': {
    letterSpacing: '0.35em',
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
  },
}

export function OtpCodeForm({
  destinationMasked,
  deliveryMode,
  resendAfter = 60,
  loading,
  error,
  onSubmit,
  onResend,
  onBack,
}: {
  destinationMasked?: string | null
  deliveryMode?: string | null
  resendAfter?: number
  loading: boolean
  error: string | null
  onSubmit: (code: string) => void
  onResend: () => void
  onBack: () => void
}) {
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(resendAfter)
  const submittedRef = useRef<string | null>(null)

  useEffect(() => {
    setCooldown(resendAfter)
    setCode('')
    submittedRef.current = null
  }, [resendAfter, destinationMasked])

  useEffect(() => {
    if (error) submittedRef.current = null
  }, [error])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  function applyCode(raw: string, { autoSubmit = true } = {}) {
    const next = normalizeOtpCode(raw)
    setCode(next)
    if (
      autoSubmit &&
      isCompleteOtp(next) &&
      !loading &&
      submittedRef.current !== next
    ) {
      submittedRef.current = next
      onSubmit(next)
    }
  }

  return (
    <Stack
      spacing={1.75}
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (isCompleteOtp(code) && !loading) {
          submittedRef.current = code
          onSubmit(code)
        }
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Введите код из SMS{destinationMasked ? ` на ${destinationMasked}` : ''}
      </Typography>
      {deliveryMode === 'console' ? (
        <Alert severity="info">
          Режим разработки (SMS_PROVIDER=console): код не уходит в реальную SMS — смотрите логи API /
          capture.
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        label="Код из SMS"
        value={code}
        onChange={(e) => applyCode(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (!text) return
          e.preventDefault()
          applyCode(text)
        }}
        inputProps={{
          inputMode: 'numeric',
          pattern: '[0-9]*',
          autoComplete: 'one-time-code',
          maxLength: 6,
          'aria-label': 'Шестизначный код из SMS',
        }}
        required
        fullWidth
        autoFocus
        sx={fieldSx}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={loading || !isCompleteOtp(code)}
        sx={{ py: 1.4, borderRadius: 2, fontWeight: 700 }}
      >
        {loading ? 'Проверяем…' : 'Подтвердить'}
      </Button>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button type="button" variant="text" disabled={cooldown > 0 || loading} onClick={onResend}>
          {cooldown > 0 ? `Отправить снова (${cooldown})` : 'Отправить код снова'}
        </Button>
        <Button type="button" variant="text" onClick={onBack} disabled={loading}>
          Назад
        </Button>
      </Box>
    </Stack>
  )
}
