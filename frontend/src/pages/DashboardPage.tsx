import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { fetchReadiness } from '@/api/credit'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import { goalLabels, statusLabels } from '@/data/labels'
import { formatDate, formatMoney } from '@/utils/format'
import type { ApplicationStatus, CreditApplication, Obligation } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 2px 12px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
} as const

function pipelineStep(status: ApplicationStatus): number {
  switch (status) {
    case 'draft':
    case 'submitted':
      return 0
    case 'docs_requested':
      return 1
    case 'in_review':
      return 2
    case 'approved':
      return 3
    case 'rejected':
    case 'issued':
      return 4
    default:
      return 0
  }
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function estimateMonthly(amount: number, termMonths: number, annualRate: number): number {
  if (!amount || !termMonths) return 0
  const r = annualRate / 100 / 12
  if (r <= 0) return amount / termMonths
  return (amount * r) / (1 - Math.pow(1 + r, -termMonths))
}

function pickActiveApp(apps: CreditApplication[]): CreditApplication | null {
  const active = apps.find((a) =>
    ['submitted', 'in_review', 'docs_requested', 'approved'].includes(a.status),
  )
  return active ?? apps.find((a) => a.status === 'draft') ?? apps[0] ?? null
}

function upcomingTasks(obligations: Obligation[]): Obligation[] {
  return [...obligations]
    .filter((o) => o.status !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4)
}

function shortMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} млн`
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс`
  return formatMoney(n)
}

/** Visual bars for finance tile — shape only (no monthly series API yet) */
function monthBars(): { label: string; h: number; active?: boolean }[] {
  const months = ['Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт']
  const factors = [0.72, 0.78, 0.7, 0.85, 0.8, 1]
  return months.map((label, i) => ({
    label,
    h: Math.max(18, Math.round(factors[i]! * 72)),
    active: i === months.length - 1,
  }))
}

export function DashboardPage() {
  const { user, selectCompany } = useAuth()
  const { company, financials, goal, apps, obligations, companyId, isLoading } = useAppStore()

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user),
  })

  const activeApp = useMemo(() => pickActiveApp(apps), [apps])
  const tasks = useMemo(() => upcomingTasks(obligations), [obligations])
  const bars = useMemo(() => monthBars(), [])

  const readinessQ = useQuery({
    queryKey: ['readiness', companyId, activeApp?.id],
    queryFn: () =>
      fetchReadiness({
        companyId: companyId!,
        applicationId: activeApp?.id,
      }),
    enabled: Boolean(companyId),
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <CircularProgress sx={{ color: '#EF3124' }} />
      </Box>
    )
  }

  if (!company) {
    return (
      <Box>
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 28, mb: 2 }}>
          {greeting()}, {user?.fullName.split(' ')[0] ?? ''}
        </Typography>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/select-company">
              Добавить компанию
            </Button>
          }
        >
          Компания ещё не выбрана — добавьте организацию по ИНН.
        </Alert>
      </Box>
    )
  }

  const freeCash = financials.avgMonthlyRevenue - financials.operatingExpenses
  const debtLoad =
    financials.avgMonthlyRevenue > 0
      ? financials.liabilities / financials.avgMonthlyRevenue
      : 0
  const step = activeApp ? pipelineStep(activeApp.status) : -1
  const offerAmount = activeApp ? Math.round(activeApp.amount * 0.6) : 0
  const monthly = activeApp
    ? estimateMonthly(offerAmount || activeApp.amount, activeApp.termMonths, activeApp.rate || 17.9)
    : 0
  const firstName = user?.fullName.split(' ')[0] ?? ''
  const appCode = activeApp
    ? activeApp.id.toUpperCase().startsWith('ABC')
      ? activeApp.id
      : `ABC-${activeApp.id.slice(-8).toUpperCase()}`
    : ''

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 1 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 30 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.15,
            }}
          >
            {greeting()}, {firstName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button
            component={RouterLink}
            to="/app/applications"
            variant="outlined"
            sx={{
              borderRadius: 2.5,
              borderColor: 'rgba(11,31,53,0.16)',
              color: '#0B1F35',
              fontWeight: 600,
              px: 2,
              bgcolor: '#fff',
            }}
          >
            Мои заявки
          </Button>
          <Button
            component={RouterLink}
            to="/app/applications/new"
            variant="contained"
            color="primary"
            sx={{ borderRadius: 2.5, fontWeight: 700, px: 2.25 }}
          >
            Новая заявка
          </Button>
        </Stack>
      </Stack>

      {(companiesQ.data?.length ?? 0) > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {(companiesQ.data ?? []).map((c) => {
            const active = c.id === companyId
            return (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => {
                  if (!active) selectCompany(c.id)
                }}
                sx={{
                  height: 34,
                  fontWeight: active ? 700 : 500,
                  bgcolor: active ? 'rgba(239,49,36,0.1)' : '#fff',
                  color: active ? '#EF3124' : '#0B1F35',
                  border: active ? '1px solid rgba(239,49,36,0.35)' : '1px solid rgba(11,31,53,0.1)',
                  '&:hover': { bgcolor: active ? 'rgba(239,49,36,0.14)' : 'rgba(11,31,53,0.04)' },
                }}
              />
            )
          })}
          <Chip
            icon={<AddRoundedIcon sx={{ fontSize: '16px !important' }} />}
            label="Добавить компанию"
            component={RouterLink}
            to="/select-company"
            clickable
            sx={{
              height: 34,
              fontWeight: 600,
              bgcolor: 'transparent',
              border: '1px dashed rgba(11,31,53,0.2)',
              color: '#5A6B7D',
            }}
          />
        </Stack>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.75,
          gridTemplateColumns: { xs: '1fr', lg: '1.45fr 0.9fr' },
          gridTemplateAreas: {
            xs: `
              "active"
              "promo"
              "tasks"
              "apps"
              "finance"
            `,
            lg: `
              "active promo"
              "active tasks"
              "apps finance"
            `,
          },
        }}
      >
        <Box sx={{ ...tileSx, gridArea: 'active', minHeight: { lg: 300 } }}>
          {activeApp ? (
            <>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: '-0.02em',
                  color: '#0B1F35',
                  mb: 1.75,
                }}
              >
                Активная заявка {appCode}
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                  gap: 1.5,
                  mb: 2.25,
                }}
              >
                <Meta label="Запрошено" value={shortMoney(activeApp.amount)} />
                <Meta
                  label="Цель"
                  value={
                    activeApp.purpose ||
                    (goal ? goalLabels[goal.goalType] : '—')
                  }
                />
                <Meta
                  label="Предложение банка"
                  value={
                    activeApp.rate
                      ? `${shortMoney(offerAmount)} · ${activeApp.rate.toFixed(1)}%`
                      : shortMoney(offerAmount)
                  }
                  accent
                />
                <Meta label="Ежемес. платёж" value={monthly ? `≈ ${shortMoney(monthly)}` : '—'} />
              </Box>

              <Stack direction="row" spacing={1.25} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
                <Button
                  component={RouterLink}
                  to={`/app/applications/${activeApp.id}`}
                  variant="contained"
                  color="primary"
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  Посмотреть условия
                </Button>
                <Button
                  component={RouterLink}
                  to={`/app/applications/${activeApp.id}`}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: 'rgba(11,31,53,0.16)',
                    color: '#0B1F35',
                    fontWeight: 600,
                    bgcolor: '#fff',
                  }}
                >
                  Трекер заявки
                </Button>
              </Stack>

              <Pipeline current={step} status={activeApp.status} />
            </>
          ) : (
            <EmptyActive readiness={readinessQ.data?.score} />
          )}
        </Box>

        <Box
          sx={{
            ...tileSx,
            gridArea: 'promo',
            bgcolor: '#EF3124',
            border: 'none',
            color: '#fff',
            backgroundImage:
              'radial-gradient(420px 200px at 100% 0%, rgba(255,255,255,0.22), transparent 55%)',
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              mb: 1,
            }}
          >
            Подберите кредит под цель бизнеса
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.4, mb: 2 }}>
            {goal
              ? `${goalLabels[goal.goalType]} · нужно ${formatMoney(goal.requiredAmount)}`
              : 'Сравните условия и оформите заявку за несколько шагов'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 'auto' }} flexWrap="wrap" useFlexGap>
            <Button
              component={RouterLink}
              to="/app/recommendations"
              sx={{
                bgcolor: '#fff',
                color: '#EF3124',
                fontWeight: 700,
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.92)' },
              }}
            >
              Начать подбор
            </Button>
            <Button
              component={RouterLink}
              to="/app/ai"
              sx={{
                color: '#fff',
                fontWeight: 600,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.45)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: '#fff' },
              }}
            >
              Спросить AI
            </Button>
          </Stack>
        </Box>

        <Box sx={{ ...tileSx, gridArea: 'tasks' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
              }}
            >
              Задачи
            </Typography>
            {tasks.length > 0 && (
              <Box
                sx={{
                  minWidth: 22,
                  height: 22,
                  px: 0.75,
                  borderRadius: 999,
                  bgcolor: '#EF3124',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {tasks.length}
              </Box>
            )}
          </Stack>
          {tasks.length === 0 ? (
            <Typography sx={{ color: '#8A96A3', fontSize: 13, lineHeight: 1.45 }}>
              Ближайших обязательств нет.
            </Typography>
          ) : (
            <Stack spacing={0}>
              {tasks.map((t) => (
                <Stack
                  key={t.id}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                  sx={{
                    py: 1,
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  {t.status === 'overdue' ? (
                    <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#EF3124', mt: 0.15 }} />
                  ) : (
                    <EventOutlinedIcon sx={{ fontSize: 18, color: '#8A96A3', mt: 0.15 }} />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0B1F35', lineHeight: 1.3 }}>
                      {t.title}
                      {t.dueDate ? ` до ${formatDate(t.dueDate).slice(0, 5)}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>

        <Box sx={{ ...tileSx, gridArea: 'apps' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
              }}
            >
              Мои заявки
            </Typography>
            <Button
              component={RouterLink}
              to="/app/applications"
              size="small"
              sx={{ fontWeight: 600, color: '#EF3124' }}
            >
              Все
            </Button>
          </Stack>
          {apps.length === 0 ? (
            <Typography sx={{ color: '#8A96A3', fontSize: 13 }}>Пока нет заявок.</Typography>
          ) : (
            <Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.8fr 1fr 0.7fr',
                  gap: 1,
                  px: 0.25,
                  pb: 0.75,
                  borderBottom: '1px solid rgba(11,31,53,0.08)',
                }}
              >
                {['Заявка', 'Сумма', 'Статус', 'Обновлено'].map((h) => (
                  <Typography key={h} sx={{ fontSize: 11, color: '#8A96A3', fontWeight: 600 }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {apps.slice(0, 5).map((a) => (
                <Box
                  key={a.id}
                  component={RouterLink}
                  to={`/app/applications/${a.id}`}
                  sx={{
                    textDecoration: 'none',
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 0.8fr 1fr 0.7fr',
                    gap: 1,
                    alignItems: 'center',
                    py: 1.1,
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    '&:hover .title': { color: '#EF3124' },
                  }}
                >
                  <Typography
                    className="title"
                    sx={{
                      fontSize: 13,
                      fontWeight: 650,
                      color: '#0B1F35',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.productName}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0B1F35' }}>
                    {formatMoney(a.amount)}
                  </Typography>
                  <Chip
                    size="small"
                    label={statusLabels[a.status]}
                    sx={{
                      height: 24,
                      fontSize: 11,
                      fontWeight: 600,
                      justifySelf: 'start',
                      bgcolor: 'rgba(11,31,53,0.04)',
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>
                    {formatDate(a.updatedAt)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ ...tileSx, gridArea: 'finance' }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.5,
            }}
          >
            Финансовый снимок
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1.25,
              mb: 2,
            }}
          >
            <Kpi label="Выручка" value={shortMoney(financials.avgMonthlyRevenue)} />
            <Kpi label="Ср. остаток" value={shortMoney(financials.cashBalance)} />
            <Kpi label="Свободный CF" value={shortMoney(freeCash)} />
            <Kpi label="Долг. нагрузка" value={`${debtLoad.toFixed(1)}x`} />
          </Box>
          <Stack direction="row" alignItems="flex-end" spacing={0.75} sx={{ height: 88, px: 0.5 }}>
            {bars.map((b) => (
              <Box key={b.label} sx={{ flex: 1, textAlign: 'center' }}>
                <Box
                  sx={{
                    height: b.h,
                    borderRadius: '6px 6px 2px 2px',
                    bgcolor: b.active ? '#EF3124' : 'rgba(11,31,53,0.1)',
                    mx: 'auto',
                    width: '70%',
                    maxWidth: 28,
                  }}
                />
                <Typography sx={{ mt: 0.5, fontSize: 10, color: '#8A96A3' }}>{b.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}

function Meta({
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
      <Typography sx={{ fontSize: 11, color: '#8A96A3', mb: 0.35 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 700,
          color: accent ? '#1B8A5A' : '#0B1F35',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ bgcolor: '#F7F8FA', borderRadius: 2, p: 1.35 }}>
      <Typography sx={{ fontSize: 11, color: '#8A96A3', mb: 0.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 750, color: '#0B1F35', letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
    </Box>
  )
}

function Pipeline({ current, status }: { current: number; status: ApplicationStatus }) {
  const labels = ['Подана', 'Проверка', 'Скоринг', 'Менеджер', 'Решение']
  return (
    <Box sx={{ mt: 'auto' }}>
      <Stack direction="row" alignItems="flex-start" spacing={0.5}>
        {labels.map((label, i) => {
          const done = i < current || (i === current && ['approved', 'issued'].includes(status))
          const active = i === current && !['approved', 'issued', 'rejected'].includes(status)
          const failed = status === 'rejected' && i === current
          return (
            <Box key={label} sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  mx: 'auto',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: failed
                    ? '#EF3124'
                    : done
                      ? '#1B8A5A'
                      : active
                        ? '#EF3124'
                        : 'rgba(11,31,53,0.08)',
                  color: done || active || failed ? '#fff' : '#8A96A3',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {done && !failed ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              <Typography
                sx={{
                  mt: 0.75,
                  fontSize: 10,
                  textAlign: 'center',
                  color: active || done ? '#0B1F35' : '#8A96A3',
                  fontWeight: active ? 700 : 500,
                  lineHeight: 1.2,
                }}
              >
                {label}
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}

function EmptyActive({ readiness }: { readiness?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: 18,
          color: '#0B1F35',
          mb: 1,
        }}
      >
        Активных заявок пока нет
      </Typography>
      <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.45, mb: 2, maxWidth: 440 }}>
        Когда отправите заявку, здесь будут сумма, предложение банка и этапы рассмотрения.
      </Typography>
      {readiness != null && (
        <Typography sx={{ color: '#8A96A3', fontSize: 13, mb: 2 }}>
          Профиль заполнен на {readiness}%
        </Typography>
      )}
      <Stack direction="row" spacing={1.25} sx={{ mt: 'auto' }}>
        <Button
          component={RouterLink}
          to="/app/recommendations"
          variant="contained"
          color="primary"
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          Подобрать кредит
        </Button>
        <Button
          component={RouterLink}
          to="/app/goals"
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: 'rgba(11,31,53,0.16)',
            color: '#0B1F35',
            fontWeight: 600,
          }}
        >
          Бизнес-цель
        </Button>
      </Stack>
    </Box>
  )
}
