import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import {
  Box,
  Button,
  Container,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { formatRuPhoneMask, isValidRuMobile, toE164 } from '@/utils/phone'

const STEPS = [
  {
    title: 'Создайте кабинет',
    description: 'Телефон или email — и профиль компании за пару минут',
  },
  {
    title: 'Укажите цель и выписку',
    description: 'Подберём продукты, покажем прогноз и готовность заявки',
  },
  {
    title: 'Отправьте менеджеру',
    description: 'Заявка уходит в очередь банка — статус виден в кабинете',
  },
]

export function ApplicationSection() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('+7 ')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const e164 = toE164(phone)
    if (!e164) return
    navigate('/register', { state: { phone: e164 } })
  }

  return (
    <Box id="how" sx={{ bgcolor: '#fff', pt: { xs: 4, md: 6 }, pb: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography
          component="h2"
          id="apply"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 28, md: 40 },
            letterSpacing: '-0.03em',
            textAlign: 'center',
            color: '#0B1F35',
            mb: { xs: 3, md: 4 },
            scrollMarginTop: 96,
          }}
        >
          Как попасть в кабинет
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 560,
            mx: 'auto',
            mb: { xs: 2.5, md: 3 },
            px: 2,
          }}
        >
          {STEPS.map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                  ...(i === 0
                    ? {
                        border: '2px dashed #C5CCD4',
                        color: '#0B1F35',
                        bgcolor: '#fff',
                      }
                    : {
                        border: '2px solid #EF3124',
                        color: '#EF3124',
                        bgcolor: '#fff',
                      }),
                }}
              >
                {i + 1}
              </Box>
              {i < STEPS.length - 1 && (
                <Box sx={{ flex: 1, height: 2, bgcolor: '#E4E8ED', mx: 1 }} />
              )}
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: { xs: 4, md: 5 },
          }}
        >
          {STEPS.map((step) => (
            <Box
              key={step.title}
              sx={{
                bgcolor: '#F0F2F5',
                borderRadius: 4,
                p: { xs: 2.5, md: 3 },
                textAlign: 'center',
                minHeight: 120,
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: { xs: 17, md: 19 },
                  color: '#0B1F35',
                  mb: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {step.title}
              </Typography>
              <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.45 }}>
                {step.description}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            bgcolor: '#F0F2F5',
            borderRadius: 5,
            p: { xs: 2, sm: 3, md: 5 },
          }}
        >
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{
              bgcolor: '#fff',
              borderRadius: 4,
              maxWidth: 520,
              mx: 'auto',
              p: { xs: 3, md: 4 },
              boxShadow: '0 4px 24px rgba(11,31,53,0.06)',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 24, md: 28 },
                letterSpacing: '-0.03em',
                color: '#0B1F35',
                mb: 1,
              }}
            >
              Открыть кредитный кабинет
            </Typography>
            <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.45, mb: 3 }}>
              Оставьте телефон — продолжим регистрацию и онбординг компании
            </Typography>

            <TextField
              label="Телефон"
              value={phone}
              onChange={(e) => setPhone(formatRuPhoneMask(e.target.value))}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (!text) return
                e.preventDefault()
                setPhone(formatRuPhoneMask(text))
              }}
              fullWidth
              required
              type="tel"
              helperText={
                phone.trim() && phone !== '+7 ' && !isValidRuMobile(phone)
                  ? 'Формат: +7 (999) 999-99-99'
                  : 'Пришлём код в смс'
              }
              error={Boolean(phone.trim() && phone !== '+7 ' && !isValidRuMobile(phone))}
              inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={2}
              sx={{
                bgcolor: '#F5F6F8',
                borderRadius: 3,
                p: 1.5,
                pl: { sm: 2 },
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1 }}>
                <ShieldOutlinedIcon sx={{ color: '#5A6B7D', fontSize: 22, flexShrink: 0 }} />
                <Typography sx={{ color: '#5A6B7D', fontSize: 13, lineHeight: 1.35 }}>
                  Данные используются только для демо-кабинета Alfa Credit
                </Typography>
              </Stack>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={!isValidRuMobile(phone)}
                sx={{
                  borderRadius: 2.5,
                  px: 4,
                  py: 1.35,
                  fontWeight: 700,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Продолжить
              </Button>
            </Stack>

            <Typography
              sx={{ mt: 2.5, color: '#8A96A3', fontSize: 12, lineHeight: 1.45, textAlign: 'center' }}
            >
              Уже есть аккаунт?{' '}
              <Link component={RouterLink} to="/login" underline="hover" sx={{ color: 'inherit' }}>
                Войти
              </Link>
              {' · '}
              демо:{' '}
              <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                ip@demo.alfa
              </Box>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
