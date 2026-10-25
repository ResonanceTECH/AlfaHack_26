import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { createApplication, submitApplication } from '@/api/applications'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import { DEMO_PRODUCTS } from '@/features/selection/demoProducts'
import { goalTitle } from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.5 },
} as const

export function ApplicationWizardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const {
    company,
    companyId,
    selectedProductId,
    products,
    transactions,
    isLoading,
    setSelectedProduct,
  } = useAppStore()

  const draft = loadSelectionDraft(companyId)
  const pickId =
    selectedProductId || draft.selectedProductId || DEMO_PRODUCTS[0]?.productId || ''

  const demo = DEMO_PRODUCTS.find((p) => p.productId === pickId)
  const catalog = products.find((p) => p.id === pickId)

  const amount = draft.amount || 5_000_000
  const term = draft.termMonths || 48
  const rate = demo?.estimatedRate ?? (catalog ? (catalog.rateMin + catalog.rateMax) / 2 : 18.75)
  const payment = useMemo(() => {
    if (demo?.productType === 'overdraft') return 0
    if (demo?.estimatedMonthlyPayment && draft.amount === 5_000_000 && draft.termMonths === 24) {
      return Math.round(annuityPayment(amount, rate, term))
    }
    return Math.round(annuityPayment(amount, rate, term))
  }, [demo, amount, rate, term, draft.amount, draft.termMonths])

  const name = demo?.productName ?? catalog?.name ?? 'Инвестиционный кредит «Рост»'
  const tag = demo?.tag ?? 'Инвестиционный кредит'
  const badge = demo?.badge ?? 'Условия требуют подтверждения банком'
  const apiProductId = catalog?.id ?? products[0]?.id

  const hasBankAccount =
    typeof localStorage !== 'undefined' &&
    companyId &&
    (localStorage.getItem(`alfa_company_bank_accounts:${companyId}`) ||
      localStorage.getItem(`alfa_company_bank_account:${companyId}`))
  const hasStatement = transactions.length > 0

  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const checks: { ok: boolean; warn?: boolean; label: string }[] = [
    { ok: Boolean(company?.name && company?.inn), label: 'Профиль компании заполнен' },
    { ok: Boolean(hasBankAccount), label: 'Банковский счёт указан' },
    {
      ok: hasStatement,
      label: hasStatement ? 'Выписка загружена и обработана' : 'Выписка загружена и обработана',
    },
    { ok: true, label: 'Согласие на обработку ПДн' },
    { ok: true, label: 'Согласие на запрос БКИ' },
    { ok: false, warn: true, label: 'Залог: условия уточнит банк' },
    { ok: false, warn: true, label: 'Финальная ставка после рассмотрения' },
  ]

  async function send() {
    if (!confirmed) {
      setError('Подтвердите достоверность данных')
      return
    }
    if (!companyId) {
      setError('Нет компании')
      return
    }
    setSaving(true)
    setError(null)
    try {
      saveSelectionDraft({ ...draft, selectedProductId: pickId }, companyId)
      setSelectedProduct(pickId)

      if (apiProductId) {
        let app = await createApplication({
          companyId,
          productId: apiProductId,
          amount,
          termMonths: term,
          rate,
          purpose: `${name} · ${goalTitle(draft.goalKey)}`,
        })
        app = await submitApplication(app.id)
        await qc.invalidateQueries({ queryKey: ['applications'] })
        navigate(`/app/applications/${app.id}`)
        return
      }

      setFlash('Демо-заявка отправлена в очередь аналитика')
      setTimeout(() => navigate('/app/applications'), 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить заявку')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading && !company) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/recommendations/results"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Подбор и сравнение
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Заявка
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
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Заявка
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            {goalTitle(draft.goalKey)} · {formatMoney(amount)} · {term} мес
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/app/recommendations/results')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Назад к подбору
        </Button>
      </Stack>

      <SelectionStepper active={5} />

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {flash && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5 }}>
          {flash}
        </Alert>
      )}

      {/* Product summary */}
      <Box
        sx={{
          ...tileSx,
          border: '1.5px solid #EF3124',
          mb: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 18,
              color: '#0B1F35',
            }}
          >
            {name}
          </Typography>
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 999,
              bgcolor: '#EEF1F4',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#5A6B7D',
            }}
          >
            {tag}
          </Box>
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 999,
              bgcolor: '#FFF0E0',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#C45A12',
            }}
          >
            {badge}
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 1.75,
          }}
        >
          <Metric label="Ставка" value={`от ${rate.toLocaleString('ru-RU')}%`} />
          <Metric label="Сумма" value={formatMoney(amount)} />
          <Metric label="Срок" value={`${term} мес`} />
          <Metric
            label="Платёж"
            value={payment ? `≈ ${formatMoney(payment)}` : 'по факту'}
            accent
          />
        </Box>

        <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', lineHeight: 1.45 }}>
          Финальные условия определяются после рассмотрения банком. Это демо-заявка.
        </Typography>
      </Box>

      {/* Readiness */}
      <Box sx={{ ...tileSx, mb: 2 }}>
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 16,
            color: '#0B1F35',
            mb: 1.75,
          }}
        >
          Готовность к отправке
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: { xs: 1.15, sm: 1.35 },
            mb: 2.25,
          }}
        >
          {checks.map((c) => (
            <Stack key={c.label} direction="row" spacing={1.1} alignItems="flex-start">
              {c.ok ? (
                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.1 }} />
              ) : (
                <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1 }} />
              )}
              <Typography
                sx={{
                  fontSize: 13.5,
                  fontWeight: 650,
                  color: '#0B1F35',
                  lineHeight: 1.35,
                }}
              >
                {c.label}
              </Typography>
            </Stack>
          ))}
        </Box>

        <FormControlLabel
          sx={{
            alignItems: 'flex-start',
            ml: 0,
            mr: 0,
            p: 1.5,
            borderRadius: 2,
            border: confirmed ? '1.5px solid #EF3124' : '1.5px solid rgba(239,49,36,0.45)',
            bgcolor: confirmed ? 'rgba(239,49,36,0.04)' : 'transparent',
            width: '100%',
          }}
          control={
            <Checkbox
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked)
                setError(null)
              }}
              sx={{
                color: '#EF3124',
                '&.Mui-checked': { color: '#EF3124' },
                pt: 0.25,
              }}
            />
          }
          label={
            <Typography sx={{ fontSize: 14, fontWeight: 650, color: '#0B1F35', pt: 0.35 }}>
              Подтверждаю достоверность данных и отправку демо-заявки
            </Typography>
          }
        />
      </Box>

      {/* Submit bar */}
      <Box
        sx={{
          ...tileSx,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography sx={{ fontSize: 13.5, color: '#7A8795', lineHeight: 1.45, maxWidth: 480 }}>
          После отправки заявка попадёт в очередь аналитика. Решения принимает человек + правила.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          disabled={saving || !confirmed}
          onClick={() => void send()}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0, alignSelf: { sm: 'center' } }}
        >
          {saving ? 'Отправляем…' : 'Отправить заявку →'}
        </Button>
      </Box>
    </Box>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 0.35 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 800,
          color: accent ? '#EF3124' : '#0B1F35',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}
