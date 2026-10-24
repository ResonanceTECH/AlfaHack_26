import Grid from '@mui/material/Grid2'
import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
  Chip,
  Box,
  CircularProgress,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { Disclaimer } from '@/components/common/Disclaimer'
import { useAppStore } from '@/hooks/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/utils/format'
import { goalLabels, statusLabels } from '@/data/labels'
import { fetchReadiness } from '@/api/credit'

export function DashboardPage() {
  const { user } = useAuth()
  const { company, financials, goal, apps, selectedProductId, companyId, isLoading } = useAppStore()

  const readinessQ = useQuery({
    queryKey: ['readiness', companyId, selectedProductId, apps[0]?.id],
    queryFn: () =>
      fetchReadiness({
        companyId: companyId!,
        productId: selectedProductId ?? undefined,
        applicationId: apps[0]?.id,
      }),
    enabled: Boolean(companyId),
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!company) {
    return (
      <Box>
        <PageHeader title={`Здравствуйте, ${user?.fullName.split(' ')[0] ?? ''}`} />
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/onboarding/company">
              Создать компанию
            </Button>
          }
        >
          Компания ещё не создана — заполните данные, чтобы подобрать кредит.
        </Alert>
      </Box>
    )
  }

  const readiness = readinessQ.data

  return (
    <Box>
      <PageHeader
        title={`Здравствуйте, ${user?.fullName.split(' ')[0]}`}
        subtitle={`${company.name} · данные из API`}
      />
      <Disclaimer />

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatBlock label="Выручка / мес." value={formatMoney(financials.avgMonthlyRevenue)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatBlock label="Расходы / мес." value={formatMoney(financials.operatingExpenses)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatBlock
            label="Потребность"
            value={goal ? formatMoney(goal.requiredAmount) : '—'}
            accent
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatBlock
            label="Готовность заявки"
            value={readiness ? `${readiness.score}/100` : '…'}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              {company.name}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip size="small" label={`ИНН ${company.inn}`} />
              <Chip size="small" label={company.legalForm === 'IP' ? 'ИП' : 'ООО'} />
              <Chip size="small" label={company.industry} />
              <Chip size="small" label={company.region} />
            </Stack>
            {goal ? (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Цель: <strong>{goalLabels[goal.goalType]}</strong> — {goal.title}. Срок потребности до{' '}
                {goal.targetDate}.
              </Typography>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Бизнес-цель ещё не задана.
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button component={RouterLink} to="/app/goals" variant="contained">
                Бизнес-цель
              </Button>
              <Button component={RouterLink} to="/app/recommendations" variant="outlined">
                Подбор кредитов
              </Button>
              <Button component={RouterLink} to="/app/scenarios" variant="outlined">
                Scenario Lab
              </Button>
              <Button component={RouterLink} to="/app/ai" variant="text">
                AI-консультант
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, height: '100%' }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              Заявки
            </Typography>
            {apps.length === 0 ? (
              <Typography color="text.secondary">Пока нет заявок.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {apps.slice(0, 3).map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(11,31,53,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={600}>{a.productName}</Typography>
                      <Chip size="small" label={statusLabels[a.status]} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {formatMoney(a.amount)} · {a.termMonths} мес.
                    </Typography>
                  </Box>
                ))}
                <Button component={RouterLink} to="/app/applications" size="small">
                  Все заявки
                </Button>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
