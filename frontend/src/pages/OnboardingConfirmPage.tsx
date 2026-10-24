import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getCompany, getFinancials, listGoals, updateFinancials } from '@/api/companies'
import {
  OnboardingWizardLayout,
  WizardInfoCard,
} from '@/components/onboarding/OnboardingWizardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { goalLabels } from '@/data/labels'
import { formatDate, formatMoney } from '@/utils/format'

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
  }
  if (err instanceof Error) return err.message
  return fallback
}

type Row = {
  label: string
  value: string
  success?: boolean
  linkLabel?: string
  linkTo?: string
}

export function OnboardingConfirmPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = user?.companyId

  const companyQ = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: Boolean(companyId),
  })
  const finQ = useQuery({
    queryKey: ['financials', companyId],
    queryFn: () => getFinancials(companyId!),
    enabled: Boolean(companyId),
  })
  const goalsQ = useQuery({
    queryKey: ['goals', companyId],
    queryFn: () => listGoals(companyId!),
    enabled: Boolean(companyId),
  })

  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!companyId) return <Navigate to="/onboarding/company" replace />

  if (companyQ.isLoading || finQ.isLoading || goalsQ.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const company = companyQ.data
  const fin = finQ.data
  const goal = goalsQ.data?.[0]

  if (!company) return <Navigate to="/onboarding/company" replace />

  async function onConfirm() {
    if (!agree) {
      setError('Подтвердите корректность данных и согласие на обработку')
      return
    }
    if (!companyId) return
    setError(null)
    setLoading(true)
    try {
      if (fin) {
        await updateFinancials(companyId, { confirmed: true })
        await qc.invalidateQueries({ queryKey: ['financials', companyId] })
      }
      sessionStorage.setItem('alfa_onboarding_done', '1')
      navigate('/app/recommendations')
    } catch (e) {
      setError(apiError(e, 'Не удалось подтвердить данные'))
    } finally {
      setLoading(false)
    }
  }

  const companyRows: Row[] = [
    { label: 'Форма бизнеса', value: company.legalForm === 'IP' ? 'ИП' : 'ООО' },
    { label: 'Название', value: company.name },
    { label: 'ИНН', value: company.inn },
    { label: 'ОГРН', value: company.ogrn },
    { label: 'Дата регистрации', value: formatDate(company.registrationDate) },
    { label: 'Сфера деятельности', value: company.industry },
    { label: 'Регион', value: company.region },
    { label: 'Количество сотрудников', value: String(company.employeesCount) },
    { label: 'Форма налогообложения', value: 'УСН Доходы' },
  ]

  const financeRows: Row[] = fin
    ? [
        { label: 'Среднемесячная выручка', value: formatMoney(fin.avgMonthlyRevenue) },
        { label: 'Среднемесячные расходы', value: formatMoney(fin.operatingExpenses) },
        { label: 'Остаток на счетах', value: formatMoney(fin.cashBalance) },
        { label: 'Действующие кредиты', value: formatMoney(fin.activeCredits) },
        { label: 'Период выписки', value: '6 месяцев' },
        {
          label: 'Файл выписки',
          value: fin.source === 'statement' ? 'Выписка загружена' : 'Заполнено вручную',
          success: fin.source === 'statement',
          linkLabel: fin.source === 'statement' ? 'Посмотреть файл' : undefined,
          linkTo: fin.source === 'statement' ? '/app/statements' : undefined,
        },
      ]
    : [{ label: 'Статус', value: 'Финансы ещё не заполнены' }]

  const goalRows: Row[] = goal
    ? [
        { label: 'Цель', value: goalLabels[goal.goalType] ?? goal.title },
        { label: 'Описание', value: goal.description || goal.title },
        { label: 'Планируемая сумма', value: formatMoney(goal.requiredAmount) },
        { label: 'Срок', value: `${goal.termMonths} месяцев` },
        { label: 'Собственные средства', value: formatMoney(goal.ownFunds) },
      ]
    : [
        { label: 'Цель', value: 'Не указана' },
        {
          label: 'Подсказка',
          value: 'Можно заполнить позже в разделе «Бизнес-цель»',
          linkLabel: 'Указать цель',
          linkTo: '/app/goals',
        },
      ]

  return (
    <OnboardingWizardLayout
      step={3}
      company={company}
      onBack={() => navigate('/onboarding/finances')}
      onContinue={() => void onConfirm()}
      continueLabel="Подтвердить и перейти к подбору"
      continueDisabled={!agree}
      continueLoading={loading}
      right={
        <>
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              p: 2.25,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 2.25 }}>Что дальше?</Typography>
            <Stack spacing={2.25}>
              <NextItem
                icon={<RecommendOutlinedIcon sx={{ fontSize: 18 }} />}
                title="Подбор кредитных предложений"
                time="1–2 минуты"
                text="Подберём продукты под ваш профиль и сумму"
              />
              <NextItem
                icon={<CompareArrowsOutlinedIcon sx={{ fontSize: 18 }} />}
                title="Сравнение условий"
                time="2–3 минуты"
                text="Сравните ставку, срок и график платежей"
              />
              <NextItem
                icon={<AssignmentOutlinedIcon sx={{ fontSize: 18 }} />}
                title="Отправка заявки"
                time="5–10 минут"
                text="Оформите заявку и отправьте на рассмотрение"
                last
              />
            </Stack>
          </Box>

          <WizardInfoCard>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <InfoOutlinedIcon sx={{ color: '#2563EB', fontSize: 20, mt: 0.1 }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.35 }}>
                  Ваши данные в безопасности
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.45 }}>
                  Обработка персональных данных ведётся в соответствии с 152-ФЗ. Информация
                  используется только для подбора и рассмотрения заявки.
                </Typography>
              </Box>
            </Stack>
          </WizardInfoCard>

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2.5,
              border: '1.5px solid',
              borderColor: agree ? 'primary.main' : 'divider',
              px: 1.5,
              py: 1,
            }}
          >
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0 }}
              control={
                <Checkbox
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  color="primary"
                  sx={{ pt: 0.25 }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.45 }}>
                  Подтверждаю корректность указанных сведений и соглашаюсь на{' '}
                  <Link href="#" underline="hover" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    обработку персональных данных
                  </Link>{' '}
                  и{' '}
                  <Link href="#" underline="hover" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    условия сервиса
                  </Link>
                </Typography>
              }
            />
          </Box>
        </>
      }
    >
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.45rem', sm: '1.75rem' },
          letterSpacing: '-0.03em',
          mb: 0.75,
        }}
      >
        Проверьте данные
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14.5, mb: 3, maxWidth: 580, lineHeight: 1.45 }}>
        Эта информация будет использована для подбора кредитных продуктов. При необходимости
        отредактируйте разделы ниже.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={2}>
        <ReviewCard
          icon={<BusinessOutlinedIcon sx={{ fontSize: 20 }} />}
          title="Информация о компании"
          editTo="/onboarding/company"
          rows={companyRows}
        />
        <ReviewCard
          icon={<ShowChartOutlinedIcon sx={{ fontSize: 20 }} />}
          title="Финансовые показатели"
          editTo="/onboarding/finances"
          rows={financeRows}
        />
        <ReviewCard
          icon={<FlagOutlinedIcon sx={{ fontSize: 20 }} />}
          title="Бизнес-цель и потребность"
          editTo="/app/goals"
          rows={goalRows}
        />
      </Stack>

      {/* mobile consent — на десктопе чекбокс в правом сайдбаре */}
      <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 2 }}>
        <Box
          sx={{
            border: '1.5px solid',
            borderColor: agree ? 'primary.main' : 'divider',
            borderRadius: 2,
            px: 1.5,
            py: 1,
          }}
        >
          <FormControlLabel
            sx={{ alignItems: 'flex-start', m: 0 }}
            control={
              <Checkbox
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                color="primary"
                sx={{ pt: 0.25 }}
              />
            }
            label={
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.45 }}>
                Подтверждаю корректность сведений и соглашаюсь на обработку персональных данных и
                условия сервиса
              </Typography>
            }
          />
        </Box>
      </Box>
    </OnboardingWizardLayout>
  )
}

function ReviewCard({
  icon,
  title,
  editTo,
  rows,
}: {
  icon: ReactNode
  title: string
  editTo: string
  rows: Row[]
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2.5,
        p: { xs: 2, sm: 2.5 },
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'rgba(239,49,36,0.1)',
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {icon}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>{title}</Typography>
        </Stack>
        <Button
          component={RouterLink}
          to={editTo}
          startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            fontWeight: 600,
            fontSize: 13,
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
          }}
        >
          Редактировать
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          columnGap: 3,
          rowGap: 1.75,
        }}
      >
        {rows.map((r) => (
          <Box key={`${r.label}-${r.value}`}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.35 }}>
              {r.label}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              {r.success ? <CheckCircleIcon sx={{ fontSize: 16, color: '#1B8A5A' }} /> : null}
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{r.value}</Typography>
              {r.linkLabel && r.linkTo ? (
                <Link
                  component={RouterLink}
                  to={r.linkTo}
                  underline="hover"
                  sx={{ fontSize: 13, fontWeight: 600, color: 'primary.main' }}
                >
                  {r.linkLabel}
                </Link>
              ) : null}
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function NextItem({
  icon,
  title,
  time,
  text,
  last,
}: {
  icon: ReactNode
  title: string
  time: string
  text: string
  last?: boolean
}) {
  return (
    <Stack direction="row" spacing={1.5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            bgcolor: 'rgba(239,49,36,0.1)',
            color: 'primary.main',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        {!last ? (
          <Box sx={{ width: 2, flex: 1, minHeight: 22, bgcolor: 'rgba(239,49,36,0.2)', my: 0.5 }} />
        ) : null}
      </Box>
      <Box sx={{ pb: last ? 0 : 0.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3, mb: 0.15 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 600, mb: 0.35 }}>
          {time}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.4 }}>
          {text}
        </Typography>
      </Box>
    </Stack>
  )
}
