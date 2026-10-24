import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchReadiness } from '@/api/credit'

export function ReadinessPage() {
  const { companyId, selectedProductId, apps, products } = useAppStore()
  const product = products.find((p) => p.id === selectedProductId) ?? null

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

  if (!companyId) {
    return (
      <Box>
        <PageHeader title="Индекс кредитной готовности" />
        <Alert severity="warning">Нет компании</Alert>
      </Box>
    )
  }

  if (readinessQ.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (readinessQ.isError || !readinessQ.data) {
    return (
      <Box>
        <PageHeader title="Индекс кредитной готовности" />
        <Alert severity="error">
          {(readinessQ.error as Error)?.message ?? 'Не удалось рассчитать индекс'}
        </Alert>
      </Box>
    )
  }

  const result = readinessQ.data

  return (
    <Box>
      <PageHeader
        title="Индекс кредитной готовности"
        subtitle={`Продуктовый индекс 0–100. Версия: ${result.version}`}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock label="Итоговый индекс" value={`${result.score}/100`} accent />
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <Paper sx={{ p: 2.5, height: '100%' }} elevation={1}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Продукт: {product?.name ?? 'не выбран'} · обновлено{' '}
              {new Date(result.updatedAt).toLocaleString('ru-RU')}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={result.score}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {result.factors.map((f) => (
          <Grid key={f.key} size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2.5, height: '100%' }} elevation={1}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography fontWeight={700}>{f.label}</Typography>
                <Typography color="primary" fontWeight={700}>
                  {f.score}/{f.maxScore}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(f.score / Math.max(1, f.maxScore)) * 100}
                sx={{ mb: 1, height: 6, borderRadius: 3 }}
              />
              {f.missing.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Пробелы: {f.missing.join(', ')}
                </Typography>
              )}
              <List dense>
                {f.recommendations.map((r) => (
                  <ListItem key={r} disableGutters>
                    <ListItemText primary={r} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
