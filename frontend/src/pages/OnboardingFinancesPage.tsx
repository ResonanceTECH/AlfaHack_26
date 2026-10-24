import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getCompany, getFinancials, updateFinancials } from '@/api/companies'
import { importStatement } from '@/api/statements'
import {
  OnboardingWizardLayout,
  StatusChip,
  WizardInfoCard,
} from '@/components/onboarding/OnboardingWizardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/utils/format'

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

function parseMoney(raw: string): number {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatInputMoney(n: number): string {
  if (!n) return ''
  return new Intl.NumberFormat('ru-RU').format(n)
}

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2 },
}

export function OnboardingFinancesPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

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

  const [revenue, setRevenue] = useState('')
  const [expenses, setExpenses] = useState('')
  const [cash, setCash] = useState('')
  const [credits, setCredits] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{
    inflow: number
    outflow: number
    net: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!finQ.data) return
    setRevenue(formatInputMoney(finQ.data.avgMonthlyRevenue))
    setExpenses(formatInputMoney(finQ.data.operatingExpenses))
    setCash(formatInputMoney(finQ.data.cashBalance))
    setCredits(formatInputMoney(finQ.data.activeCredits))
  }, [finQ.data])

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!companyId) return <Navigate to="/onboarding/company" replace />

  if (companyQ.isLoading || finQ.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const company = companyQ.data
  const rev = parseMoney(revenue)
  const exp = parseMoney(expenses)
  const analysis = importSummary ?? {
    inflow: rev || 0,
    outflow: exp || 0,
    net: (rev || 0) - (exp || 0),
  }
  const hasData = rev > 0 || exp > 0 || Boolean(importSummary)

  async function onUpload(file: File) {
    if (!companyId) return
    setError(null)
    setUploading(true)
    try {
      const result = await importStatement(companyId, file)
      setFileName(file.name)
      const months = Math.max(result.monthly.length, 1)
      const inflow = Math.round(result.summary.totalInflow / months)
      const outflow = Math.round(result.summary.totalOutflow / months)
      setImportSummary({
        inflow,
        outflow,
        net: Math.round(result.summary.netCashFlow / months),
      })
      if (!revenue) setRevenue(formatInputMoney(inflow))
      if (!expenses) setExpenses(formatInputMoney(outflow))
      await qc.invalidateQueries({ queryKey: ['financials', companyId] })
      await qc.invalidateQueries({ queryKey: ['transactions', companyId] })
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить выписку'))
    } finally {
      setUploading(false)
    }
  }

  async function onContinue() {
    if (!companyId) return
    setError(null)
    setLoading(true)
    try {
      await updateFinancials(companyId, {
        period: new Date().toISOString().slice(0, 7),
        avgMonthlyRevenue: parseMoney(revenue),
        operatingExpenses: parseMoney(expenses),
        cashBalance: parseMoney(cash),
        activeCredits: parseMoney(credits),
        liabilities: parseMoney(credits),
        source: fileName ? 'statement' : 'manual',
        confirmed: false,
      })
      await qc.invalidateQueries({ queryKey: ['financials', companyId] })
      navigate('/onboarding/confirm')
    } catch (e) {
      setError(apiError(e, 'Не удалось сохранить финансы'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingWizardLayout
      step={2}
      company={company}
      onBack={() => navigate('/onboarding/company')}
      onContinue={() => void onContinue()}
      continueLoading={loading}
      right={
        <>
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Анализ финансов</Typography>
              {hasData ? <StatusChip label="Данные загружены" /> : <StatusChip label="Нет данных" color="default" />}
            </Stack>
            <Stack spacing={1.5}>
              <MetricRow
                icon={<TrendingUpIcon sx={{ fontSize: 18, color: '#1B8A5A' }} />}
                label="Среднемес. поступления"
                value={formatMoney(analysis.inflow)}
              />
              <MetricRow
                icon={<TrendingDownIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
                label="Среднемес. списания"
                value={formatMoney(analysis.outflow)}
              />
              <MetricRow
                icon={<ShowChartIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                label="Чистый денежный поток"
                value={formatMoney(analysis.net)}
              />
              <MetricRow
                icon={<ShowChartIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                label="Сезонность"
                value="Умеренная"
              />
              <MetricRow
                icon={<AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                label="Период анализа"
                value="12 месяцев"
              />
            </Stack>
          </Box>

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" mb={1.25}>
              <LightbulbOutlinedIcon sx={{ color: '#D97706', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Подсказки</Typography>
            </Stack>
            <Stack spacing={1}>
              {[
                'Указывайте средние значения за 12 месяцев',
                'Учитывайте сезонность бизнеса',
                'Данные используются только для подбора',
              ].map((t) => (
                <Stack key={t} direction="row" spacing={1} alignItems="flex-start">
                  <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#1B8A5A', mt: 0.2 }} />
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.35 }}>
                    {t}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </>
      }
    >
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.4rem', sm: '1.65rem' },
          letterSpacing: '-0.03em',
          mb: 0.75,
        }}
      >
        Финансовые показатели
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 3, maxWidth: 560 }}>
        Эти данные помогут подобрать подходящие кредитные продукты и рассчитать комфортную нагрузку
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 2 }}>Основные показатели</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
          mb: 3.5,
        }}
      >
        <MoneyField
          label="Среднемесячная выручка"
          hint="Средняя выручка за последние 12 месяцев"
          value={revenue}
          onChange={setRevenue}
        />
        <MoneyField
          label="Среднемесячные расходы"
          hint="Аренда, зарплаты, закупки, маркетинг и прочие расходы"
          value={expenses}
          onChange={setExpenses}
        />
        <MoneyField label="Остаток на счетах" value={cash} onChange={setCash} />
        <MoneyField
          label="Действующие кредиты"
          hint="Сумма ежемесячных платежей по текущим кредитам"
          value={credits}
          onChange={setCredits}
        />
      </Box>

      <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>Банковская выписка</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mb: 1.5 }}>
        Загрузите выписку за последние 6–12 месяцев — мы автоматически проанализируем обороты
      </Typography>

      <Box
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) void onUpload(f)
        }}
        sx={{
          border: '1.5px dashed',
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: '#F7F9FC',
          p: { xs: 2.5, sm: 3.5 },
          textAlign: 'center',
          mb: 2,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onUpload(f)
          }}
        />
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            bgcolor: 'rgba(239,49,36,0.1)',
            color: 'primary.main',
            display: 'grid',
            placeItems: 'center',
            mx: 'auto',
            mb: 1.5,
          }}
        >
          {uploading ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            <DescriptionOutlinedIcon />
          )}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 0.5 }}>
          {fileName ? `Загружено: ${fileName}` : 'Перетащите файл сюда или выберите на компьютере'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CloudUploadOutlinedIcon />}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          sx={{ mt: 1.5, borderRadius: 2, fontWeight: 600 }}
        >
          Выбрать файл
        </Button>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.25 }}>
          Поддерживаемые форматы: PDF, XLSX, CSV. Размер файла до 50 МБ
        </Typography>
      </Box>

      <WizardInfoCard>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <InfoOutlinedIcon sx={{ color: '#2563EB', fontSize: 20, mt: 0.1 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.35 }}>Как это работает?</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.45 }}>
              Мы извлечём поступления и списания, оценим чистый денежный поток и подставим средние
              значения в поля выше — их можно поправить вручную.
            </Typography>
          </Box>
        </Stack>
      </WizardInfoCard>
    </OnboardingWizardLayout>
  )
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} mb={0.75}>
        <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{label}</Typography>
        <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
      </Stack>
      <TextField
        fullWidth
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d\s]/g, '')
          onChange(digits)
        }}
        onBlur={() => onChange(formatInputMoney(parseMoney(value)))}
        placeholder="0"
        InputProps={{
          endAdornment: <InputAdornment position="end">₽</InputAdornment>,
        }}
        sx={fieldSx}
      />
      {hint ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.6, lineHeight: 1.35 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  )
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.25,
          bgcolor: '#F3F5F8',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{value}</Typography>
      </Box>
    </Stack>
  )
}
