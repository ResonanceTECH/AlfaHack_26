import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import type { CreditRecommendation } from '@/types'
import { formatMoney, formatPercent } from '@/utils/format'
import { productTypeLabels } from '@/data/labels'

interface Props {
  item: CreditRecommendation
  selected?: boolean
  onToggleCompare?: () => void
  onSelect?: () => void
  onCalculate?: () => void
}

export function CreditRecommendationCard({
  item,
  selected,
  onToggleCompare,
  onSelect,
  onCalculate,
}: Props) {
  return (
    <Card
      elevation={1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: selected ? '2px solid' : 'none',
        outlineColor: 'primary.main',
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Chip size="small" label={productTypeLabels[item.productType]} sx={{ mb: 1 }} />
            <Typography variant="h6" sx={{ fontFamily: 'Manrope, sans-serif' }}>
              {item.productName}
            </Typography>
          </Box>
          <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
            {Math.round(item.matchScore * 100)}
            <Typography component="span" variant="caption" color="text.secondary">
              {' '}
              / 100
            </Typography>
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={item.matchScore * 100}
          sx={{ mt: 1.5, mb: 2, height: 6, borderRadius: 3 }}
        />

        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Typography variant="body2">
            Сумма: <strong>{formatMoney(item.recommendedAmount)}</strong>
          </Typography>
          <Typography variant="body2">
            Срок: <strong>{item.recommendedTerm} мес.</strong> · ставка ≈{' '}
            <strong>{formatPercent(item.estimatedRate)}</strong>
          </Typography>
          <Typography variant="body2">
            Платёж ≈ <strong>{formatMoney(item.estimatedMonthlyPayment)}</strong>/мес.
          </Typography>
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          Почему подходит
        </Typography>
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {item.reasons.map((r) => (
            <Typography key={r} variant="body2">
              • {r}
            </Typography>
          ))}
        </Stack>
        {item.warnings.map((w) => (
          <Typography key={w} variant="caption" color="warning.main" display="block">
            ⚠ {w}
          </Typography>
        ))}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {onToggleCompare && (
          <Button size="small" variant={selected ? 'contained' : 'outlined'} onClick={onToggleCompare}>
            {selected ? 'В сравнении' : 'Сравнить'}
          </Button>
        )}
        {onCalculate && (
          <Button size="small" onClick={onCalculate}>
            Калькулятор
          </Button>
        )}
        {onSelect && (
          <Button size="small" variant="contained" onClick={onSelect}>
            Выбрать
          </Button>
        )}
      </CardActions>
    </Card>
  )
}
