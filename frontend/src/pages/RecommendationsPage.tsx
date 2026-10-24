import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { Disclaimer } from '@/components/common/Disclaimer'
import { EmptyState } from '@/components/common/EmptyState'
import { CreditRecommendationCard } from '@/features/credit/CreditRecommendationCard'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchRecommendations } from '@/api/credit'
import { formatMoney } from '@/utils/format'
import { goalLabels } from '@/data/labels'

export function RecommendationsPage() {
  const { companyId, goal, compareIds, setCompareIds, setSelectedProduct } = useAppStore()
  const navigate = useNavigate()

  const recQ = useQuery({
    queryKey: ['recommendations', companyId, goal?.id],
    queryFn: () =>
      fetchRecommendations({
        companyId: companyId!,
        businessGoalId: goal?.id,
        amount: goal?.requiredAmount,
        termMonths: goal?.termMonths,
      }),
    enabled: Boolean(companyId && goal),
  })

  if (!goal) {
    return (
      <Box>
        <PageHeader title="Подбор кредитов" />
        <EmptyState
          title="Сначала укажите бизнес-цель"
          description="Цель и сумма потребности определяют eligibility и ранжирование."
          actionLabel="Мастер цели"
          actionTo="/app/goals"
        />
      </Box>
    )
  }

  const result = recQ.data

  return (
    <Box>
      <PageHeader
        title="Персональные рекомендации"
        subtitle={`Цель «${goalLabels[goal.goalType]}», сумма ${formatMoney(goal.requiredAmount)}.`}
        crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'Подбор' }]}
      />
      <Disclaimer />

      {recQ.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {recQ.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {(recQ.error as Error).message || 'Не удалось получить рекомендации'}
        </Alert>
      )}

      {result && (
        <>
          <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
            Это не официальное предложение банка (is_official_offer: false). Модель:{' '}
            {result.modelVersion}
          </Alert>

          {result.recommendations.length === 0 ? (
            <EmptyState
              title="Нет подходящих продуктов"
              description="Измените сумму, срок или цель — формально неподходящие варианты скрыты."
              actionLabel="Изменить цель"
              actionTo="/app/goals"
            />
          ) : (
            <Grid container spacing={2}>
              {result.recommendations.map((item) => (
                <Grid key={item.productId} size={{ xs: 12, md: 6, lg: 4 }}>
                  <CreditRecommendationCard
                    item={item}
                    selected={compareIds.includes(item.productId)}
                    onToggleCompare={() => {
                      const next = compareIds.includes(item.productId)
                        ? compareIds.filter((id) => id !== item.productId)
                        : [...compareIds, item.productId].slice(0, 3)
                      setCompareIds(next)
                    }}
                    onSelect={() => {
                      setSelectedProduct(item.productId)
                      navigate('/app/applications/new')
                    }}
                    onCalculate={() => {
                      setSelectedProduct(item.productId)
                      navigate('/app/calculator')
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {compareIds.length >= 2 && (
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Typography
                component="button"
                onClick={() => navigate('/app/compare')}
                sx={{
                  border: 'none',
                  bgcolor: 'transparent',
                  color: 'primary.main',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                Сравнить выбранные ({compareIds.length}) →
              </Typography>
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}
