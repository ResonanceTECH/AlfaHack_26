import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { Disclaimer } from '@/components/common/Disclaimer'
import { fetchForecast } from '@/api/statements'
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney, formatDate } from '@/utils/format'

export function ForecastPage() {
  const { companyId } = useAppStore()
  const [horizon, setHorizon] = useState<30 | 90 | 180>(90)

  const forecastQ = useQuery({
    queryKey: ['forecast', companyId, horizon],
    queryFn: () => fetchForecast(companyId!, horizon),
    enabled: Boolean(companyId),
  })

  if (!companyId) {
    return (
      <Box>
        <PageHeader title="Прогноз денежных потоков" />
        <Alert severity="warning">Нет компании</Alert>
      </Box>
    )
  }

  const forecast = forecastQ.data

  return (
    <Box>
      <PageHeader
        title="Прогноз денежных потоков"
        subtitle="Расчёт на бэкенде по транзакциям и остатку."
      />
      <Disclaimer dense />

      <ToggleButtonGroup
        exclusive
        value={horizon}
        onChange={(_, v) => v && setHorizon(v)}
        sx={{ mt: 2, mb: 2 }}
        size="small"
      >
        <ToggleButton value={30}>30 дней</ToggleButton>
        <ToggleButton value={90}>90 дней</ToggleButton>
        <ToggleButton value={180}>180 дней</ToggleButton>
      </ToggleButtonGroup>

      {forecastQ.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {forecastQ.isError && (
        <Alert severity="error">{(forecastQ.error as Error).message}</Alert>
      )}

      {forecast && (
        <>
          {forecast.warning && (
            <Alert
              severity={forecast.dataQuality === 'insufficient' ? 'warning' : 'info'}
              sx={{ mb: 2 }}
            >
              {forecast.warning} · качество данных: {forecast.dataQuality} · {forecast.modelVersion}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock
                label="Min balance"
                value={formatMoney(forecast.minimumBalance)}
                accent={forecast.minimumBalance < 0}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock
                label="Cash gap"
                value={
                  forecast.cashGapAmount != null ? formatMoney(forecast.cashGapAmount) : 'Нет'
                }
                hint={forecast.cashGapDate ? formatDate(forecast.cashGapDate) : undefined}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Горизонт" value={`${forecast.horizonDays} дн.`} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatBlock label="Точек" value={String(forecast.points.length)} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, height: 400 }} elevation={1}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast.points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(5)} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  name="Upper"
                  stroke="transparent"
                  fill="#EF312433"
                />
                <Area
                  type="monotone"
                  dataKey="lowerBound"
                  name="Lower"
                  stroke="transparent"
                  fill="#fff"
                />
                <Line
                  type="monotone"
                  dataKey="closingBalance"
                  name="Баланс"
                  stroke="#EF3124"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Модель: {forecast.modelVersion}
          </Typography>
        </>
      )}
    </Box>
  )
}
