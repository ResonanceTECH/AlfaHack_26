import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchRecommendations } from '@/api/credit'
import { formatMoney, formatPercent } from '@/utils/format'
import { productTypeLabels } from '@/data/labels'

export function ComparePage() {
  const { compareIds, companyId, goal, products, setSelectedProduct } = useAppStore()
  const navigate = useNavigate()

  const selected = products.filter((p) => compareIds.includes(p.id))

  const recQ = useQuery({
    queryKey: ['recommendations', companyId, goal?.id],
    queryFn: () =>
      fetchRecommendations({
        companyId: companyId!,
        businessGoalId: goal?.id,
        amount: goal?.requiredAmount,
        termMonths: goal?.termMonths,
      }),
    enabled: Boolean(companyId && goal && selected.length >= 2),
  })

  const recs = recQ.data?.recommendations ?? []

  if (selected.length < 2) {
    return (
      <Box>
        <PageHeader title="Сравнение кредитов" />
        <EmptyState
          title="Выберите 2–3 продукта"
          description="Отметьте продукты кнопкой «Сравнить» на экране рекомендаций."
          actionLabel="К рекомендациям"
          actionTo="/app/recommendations"
        />
      </Box>
    )
  }

  const rows: { label: string; get: (id: string) => string }[] = [
    {
      label: 'Тип',
      get: (id) => productTypeLabels[selected.find((p) => p.id === id)!.type],
    },
    {
      label: 'Сумма (лимит)',
      get: (id) => {
        const p = selected.find((x) => x.id === id)!
        return `${formatMoney(p.amountMin)} – ${formatMoney(p.amountMax)}`
      },
    },
    {
      label: 'Срок',
      get: (id) => {
        const p = selected.find((x) => x.id === id)!
        return `${p.termMin}–${p.termMax} мес.`
      },
    },
    {
      label: 'Ставка (каталог)',
      get: (id) => {
        const p = selected.find((x) => x.id === id)!
        return `${formatPercent(p.rateMin)} – ${formatPercent(p.rateMax)}`
      },
    },
    {
      label: 'Оценочный платёж',
      get: (id) => {
        const r = recs.find((x) => x.productId === id)
        return r ? formatMoney(r.estimatedMonthlyPayment) : '—'
      },
    },
    {
      label: 'Залог',
      get: (id) =>
        selected.find((p) => p.id === id)!.collateralRequired ? 'Требуется' : 'Не обязателен',
    },
    {
      label: 'Match score',
      get: (id) => {
        const r = recs.find((x) => x.productId === id)
        return r ? String(Math.round(r.matchScore * 100)) : '—'
      },
    },
    {
      label: 'Документы',
      get: (id) => selected.find((p) => p.id === id)!.documents.join(', '),
    },
  ]

  return (
    <Box>
      <PageHeader
        title="Сравнение продуктов"
        subtitle="До 3 продуктов. Параметры из каталога и расчётного сервиса."
        crumbs={[{ label: 'Подбор', to: '/app/recommendations' }, { label: 'Сравнение' }]}
      />

      <TableContainer component={Paper} elevation={1}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 700,
                  minWidth: 160,
                  position: 'sticky',
                  left: 0,
                  bgcolor: 'background.paper',
                  zIndex: 3,
                }}
              >
                Параметр
              </TableCell>
              {selected.map((p) => (
                <TableCell key={p.id} sx={{ fontWeight: 700, minWidth: 200 }}>
                  {p.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} hover>
                <TableCell
                  sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper' }}
                >
                  {row.label}
                </TableCell>
                {selected.map((p) => (
                  <TableCell key={p.id}>{row.get(p.id)}</TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper' }} />
              {selected.map((p) => (
                <TableCell key={p.id}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setSelectedProduct(p.id)
                      navigate('/app/applications/new')
                    }}
                  >
                    Выбрать
                  </Button>
                  <Button
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={() => {
                      setSelectedProduct(p.id)
                      navigate('/app/calculator')
                    }}
                  >
                    Калькулятор
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Преимущества и ограничения смотрите в reasons/warnings на карточке рекомендации.
      </Typography>
    </Box>
  )
}
