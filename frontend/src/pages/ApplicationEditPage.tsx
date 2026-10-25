import {
  Box,
  Button,
  InputAdornment,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom'

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
} as const

type Choice = 'accept' | 'edit' | 'reject' | null

type EditableApp = {
  id: string
  title: string
  company: string
  originalAmount: number
  originalTerm: number
  originalRateFrom: number
  originalPayment: number
  submittedAt: string
  offerAmount: number
  offerTerm: number
  offerRate: number
  offerPayment: number
  editAmount: number
  editTerm: number
  editRate: number
  purpose: string
  comment: string
  minAmount: number
  maxAmount: number
}

const EDITABLE: Record<string, EditableApp> = {
  'ABC-2026-1042': {
    id: 'ABC-2026-1042',
    title: 'Пополнение оборотных средств',
    company: 'ООО «Кофе Плюс»',
    originalAmount: 5_000_000,
    originalTerm: 24,
    originalRateFrom: 12.9,
    originalPayment: 237_000,
    submittedAt: '18.10.2026',
    offerAmount: 3_000_000,
    offerTerm: 24,
    offerRate: 14.9,
    offerPayment: 145_317,
    editAmount: 4_000_000,
    editTerm: 36,
    editRate: 15.5,
    purpose: 'Пополнение оборотных средств',
    comment:
      'Готовы снизить сумму до 4 млн и увеличить срок до 36 мес. Просим пересчитать предложение.',
    minAmount: 1_000_000,
    maxAmount: 5_000_000,
  },
}

function money(n: number) {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

function moneyShort(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

function approxPayment(amount: number, termMonths: number, annualRate: number) {
  if (amount <= 0 || termMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r <= 0) return amount / termMonths
  const k = (r * (1 + r) ** termMonths) / ((1 + r) ** termMonths - 1)
  return amount * k
}

function MetricBlock({
  label,
  value,
  valueColor,
  rows,
  footer,
  highlight,
  badge,
}: {
  label: string
  value: string
  valueColor?: string
  rows: { k: string; v: string }[]
  footer?: string
  highlight?: boolean
  badge?: string
}) {
  return (
    <Box
      sx={{
        ...tileSx,
        position: 'relative',
        border: highlight ? '1.5px solid #EF3124' : tileSx.border,
        bgcolor: highlight ? 'rgba(239,49,36,0.02)' : '#fff',
      }}
    >
      {badge && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            px: 1,
            py: 0.3,
            borderRadius: 999,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {badge}
        </Box>
      )}
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 1 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: 22, md: 26 },
          letterSpacing: '-0.03em',
          color: valueColor ?? '#0B1F35',
          lineHeight: 1.15,
          mb: 1.5,
          pr: badge ? 8 : 0,
        }}
      >
        {value}
      </Typography>
      <Stack spacing={0.65}>
        {rows.map((r) => (
          <Stack key={r.k} direction="row" justifyContent="space-between" spacing={1}>
            <Typography sx={{ fontSize: 13, color: '#9AA5B1' }}>{r.k}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0B1F35' }}>{r.v}</Typography>
          </Stack>
        ))}
      </Stack>
      {footer && (
        <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1.5 }}>{footer}</Typography>
      )}
    </Box>
  )
}

export function ApplicationEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const app = id ? EDITABLE[id] : undefined

  const [choice, setChoice] = useState<Choice>(null)
  const [amount, setAmount] = useState(app?.editAmount ?? 0)
  const [term, setTerm] = useState(app?.editTerm ?? 12)
  const [rate, setRate] = useState(app?.editRate ?? 15)
  const [comment, setComment] = useState(app?.comment ?? '')
  const [flash, setFlash] = useState<string | null>(null)

  const payment = useMemo(() => approxPayment(amount, term, rate), [amount, term, rate])
  const editing = choice === 'edit'

  if (!app) {
    return <Navigate to="/app/applications" replace />
  }
  const current = app

  const current = app

  function resetForm() {
    setAmount(current.editAmount)
    setTerm(current.editTerm)
    setRate(current.editRate)
    setComment(current.comment)
  }

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function saveChanges() {
    if (choice === 'accept') {
      flashMsg('Условия банка приняты')
      window.setTimeout(() => navigate(`/app/applications/${current.id}/contract`), 700)
      return
    }
    if (choice === 'reject') {
      flashMsg('Альтернатива отклонена')
      window.setTimeout(() => navigate('/app/applications'), 900)
      return
    }
    if (choice === 'edit') {
      flashMsg('Правки отправлены на пересмотр')
      window.setTimeout(() => navigate('/app/applications'), 900)
      return
    }
    flashMsg('Выберите действие справа')
  }

  function sendEdits() {
    setChoice('edit')
    flashMsg('Правки отправлены на пересмотр')
    window.setTimeout(() => navigate('/app/applications'), 1000)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/applications"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Мои заявки
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          {app.id}
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 24, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Редактирование заявки
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.65, lineHeight: 1.45 }}>
            {app.title} · {app.company} · есть альтернатива банка
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate('/app/applications')}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            ← К списку
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={saveChanges}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Сохранить изменения
          </Button>
        </Stack>
      </Stack>

      {flash && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {flash}
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          alignItems: 'flex-start',
          px: 1.75,
          py: 1.4,
          borderRadius: 2.5,
          bgcolor: '#FFF8EB',
          border: '1px solid rgba(196,90,18,0.2)',
          mb: 2.25,
        }}
      >
        <Typography sx={{ fontSize: 13.5, color: '#7A5A3A', lineHeight: 1.5 }}>
          Банк предложил альтернативу: {money(app.offerAmount)} на {app.offerTerm} мес. под{' '}
          {String(app.offerRate).replace('.', ',')}%. Можно принять условия или изменить заявку для
          повторного рассмотрения.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          mb: 2.5,
          alignItems: 'stretch',
        }}
      >
        <MetricBlock
          label="Изначальный запрос"
          value={money(app.originalAmount)}
          rows={[
            { k: 'Срок', v: `${app.originalTerm} мес` },
            { k: 'Ставка', v: `от ${String(app.originalRateFrom).replace('.', ',')}%` },
            { k: 'Платёж', v: `≈ ${moneyShort(app.originalPayment)} ₽` },
          ]}
          footer={`Подана ${app.submittedAt}`}
        />
        <MetricBlock
          label="Предложение банка"
          value={money(app.offerAmount)}
          valueColor="#EF3124"
          highlight
          badge="Рекомендуем"
          rows={[
            { k: 'Срок', v: `${app.offerTerm} мес` },
            { k: 'Ставка', v: `${String(app.offerRate).replace('.', ',')}%` },
            { k: 'Платёж', v: `≈ ${moneyShort(app.offerPayment)} ₽` },
          ]}
        />

        <Box sx={tileSx}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 1.25 }}>
            Что сделать
          </Typography>
          <Stack spacing={1}>
            <Box
              component="button"
              type="button"
              onClick={() => setChoice('accept')}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                p: 1.35,
                borderRadius: 2.5,
                border:
                  choice === 'accept'
                    ? '1.5px solid #EF3124'
                    : '1px solid rgba(239,49,36,0.35)',
                bgcolor: choice === 'accept' ? 'rgba(239,49,36,0.04)' : '#fff',
                boxSizing: 'border-box',
              }}
            >
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0B1F35' }}>
                Принять условия банка
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#7A8795', mt: 0.35, lineHeight: 1.4 }}>
                {money(app.offerAmount)} · {app.offerTerm} мес ·{' '}
                {String(app.offerRate).replace('.', ',')}%
              </Typography>
            </Box>

            <Box
              component="button"
              type="button"
              onClick={() => setChoice('edit')}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                p: 1.35,
                borderRadius: 2.5,
                border:
                  choice === 'edit' ? '1.5px solid #EF3124' : '1px solid rgba(11,31,53,0.12)',
                bgcolor: choice === 'edit' ? 'rgba(239,49,36,0.03)' : '#fff',
                boxSizing: 'border-box',
              }}
            >
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0B1F35' }}>
                Изменить свою заявку
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#7A8795', mt: 0.35, lineHeight: 1.4 }}>
                Сумма, срок и комментарий банку
              </Typography>
            </Box>

            <Button
              type="button"
              fullWidth
              onClick={() => setChoice('reject')}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                py: 1.05,
                color: choice === 'reject' ? '#C41E14' : '#5A6B7D',
                bgcolor: choice === 'reject' ? 'rgba(196,30,20,0.06)' : '#F2F4F6',
                border: choice === 'reject' ? '1px solid rgba(196,30,20,0.3)' : '1px solid transparent',
                '&:hover': { bgcolor: 'rgba(11,31,53,0.06)' },
              }}
            >
              Отклонить альтернативу
            </Button>
          </Stack>
        </Box>
      </Box>

      {editing && (
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
            Редактирование параметров заявки
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              mb: 2,
            }}
          >
            <TextField
              label="Сумма кредита"
              size="small"
              value={moneyShort(amount)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''))
                if (!Number.isNaN(n)) {
                  setAmount(Math.min(app.maxAmount, Math.max(app.minAmount, n || app.minAmount)))
                }
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">₽</InputAdornment>,
              }}
              sx={fieldSx}
            />
            <TextField
              label="Срок"
              size="small"
              value={term}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''))
                if (!Number.isNaN(n)) setTerm(Math.min(60, Math.max(6, n || 6)))
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">мес</InputAdornment>,
              }}
              sx={fieldSx}
            />
            <TextField
              label="Желаемая ставка"
              size="small"
              value={String(rate).replace('.', ',')}
              onChange={(e) => {
                const n = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))
                if (!Number.isNaN(n)) setRate(Math.min(40, Math.max(1, n || 1)))
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={fieldSx}
            />
            <TextField
              label="Цель"
              size="small"
              value={app.purpose}
              InputProps={{ readOnly: true }}
              sx={{
                ...fieldSx,
                '& .MuiOutlinedInput-root': {
                  ...fieldSx['& .MuiOutlinedInput-root'],
                  bgcolor: '#F7F8FA',
                },
              }}
            />
          </Box>

          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6B7D', mb: 0.75 }}>
            Корректировка суммы
          </Typography>
          <Slider
            value={amount}
            min={app.minAmount}
            max={app.maxAmount}
            step={100_000}
            onChange={(_, v) => setAmount(v as number)}
            sx={{
              color: '#EF3124',
              mb: 0.5,
              '& .MuiSlider-thumb': { width: 18, height: 18 },
            }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>
              {money(app.minAmount)}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0B1F35' }}>
              {money(amount)}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>
              {money(app.maxAmount)}
            </Typography>
          </Stack>

          <TextField
            label="Комментарий банку"
            fullWidth
            multiline
            minRows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ ...fieldSx, mb: 2 }}
          />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
              Платёж ≈ {moneyShort(payment)} ₽ / мес
              <Box component="span" sx={{ color: '#9AA5B1', fontWeight: 600, ml: 0.75 }}>
                · ориентир после правок
              </Box>
            </Typography>
            <Stack direction="row" spacing={1.25}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={resetForm}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Сбросить
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={sendEdits}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                Отправить правки →
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  )
}

/** IDs that open the alternative / edit screen instead of plain detail. */
export function isEditableApplication(id: string) {
  return Boolean(EDITABLE[id])
}
