import Grid from '@mui/material/Grid2'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { useAppStore } from '@/hooks/useAppStore'
import { updateCompany, updateFinancials } from '@/api/companies'
import { industries, regions } from '@/data/labels'
import { formatMoney, formatDateTime } from '@/utils/format'

const companySchema = z.object({
  name: z.string().min(3, 'Укажите название'),
  inn: z.string().regex(/^\d{10}(\d{2})?$/, 'ИНН: 10 или 12 цифр'),
  ogrn: z.string().min(13, 'ОГРН/ОГРНИП'),
  legalForm: z.enum(['IP', 'OOO']),
  industry: z.string().min(1),
  registrationDate: z.string().min(1),
  region: z.string().min(1),
  employeesCount: z.coerce.number().int().min(1).max(5000),
})

const finSchema = z.object({
  avgMonthlyRevenue: z.coerce.number().min(0),
  operatingExpenses: z.coerce.number().min(0),
  cashBalance: z.coerce.number().min(0),
  liabilities: z.coerce.number().min(0),
  activeCredits: z.coerce.number().min(0),
  period: z.string().min(1),
})

type CompanyForm = z.infer<typeof companySchema>
type FinForm = z.infer<typeof finSchema>

export function CompanyPage() {
  const { company, financials, companyId, isLoading } = useAppStore()
  const qc = useQueryClient()
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      inn: '',
      ogrn: '',
      legalForm: 'IP',
      industry: '',
      registrationDate: '',
      region: '',
      employeesCount: 1,
    },
  })

  const finForm = useForm<FinForm>({
    resolver: zodResolver(finSchema),
    defaultValues: {
      avgMonthlyRevenue: 0,
      operatingExpenses: 0,
      cashBalance: 0,
      liabilities: 0,
      activeCredits: 0,
      period: new Date().toISOString().slice(0, 7),
    },
  })

  useEffect(() => {
    if (!company) return
    companyForm.reset({
      name: company.name,
      inn: company.inn,
      ogrn: company.ogrn,
      legalForm: company.legalForm,
      industry: company.industry,
      registrationDate: company.registrationDate,
      region: company.region,
      employeesCount: company.employeesCount,
    })
  }, [company, companyForm])

  useEffect(() => {
    finForm.reset({
      avgMonthlyRevenue: financials.avgMonthlyRevenue,
      operatingExpenses: financials.operatingExpenses,
      cashBalance: financials.cashBalance,
      liabilities: financials.liabilities,
      activeCredits: financials.activeCredits,
      period: financials.period,
    })
  }, [financials, finForm])

  async function onSaveCompany(values: CompanyForm) {
    if (!companyId) return
    setError(null)
    try {
      await updateCompany(companyId, {
        name: values.name,
        industry: values.industry,
        region: values.region,
        employeesCount: values.employeesCount,
        ogrn: values.ogrn,
        registrationDate: values.registrationDate,
      })
      await qc.invalidateQueries({ queryKey: ['company', companyId] })
      setSaved('Профиль компании сохранён')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  async function onSaveFin(values: FinForm) {
    if (!companyId) return
    setError(null)
    try {
      await updateFinancials(companyId, { ...values, source: 'manual', confirmed: true })
      await qc.invalidateQueries({ queryKey: ['financials', companyId] })
      finForm.reset(values)
      setSaved('Финансовые показатели обновлены')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!company || !companyId) {
    return (
      <Box>
        <PageHeader title="Профиль компании" />
        <Alert severity="warning">Нет компании для этого аккаунта.</Alert>
      </Box>
    )
  }

  const freeCash = financials.avgMonthlyRevenue - financials.operatingExpenses

  return (
    <Box>
      <PageHeader
        title="Профиль компании"
        subtitle="Карточка ИП/ООО, финансы и обязательства. Данные уходят в подбор и индекс готовности."
        crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'Профиль' }]}
      />
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(null)}>
          {saved}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock label="Чистый денежный поток / мес." value={formatMoney(freeCash)} accent />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock label="Остаток на счетах" value={formatMoney(financials.cashBalance)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatBlock
            label="Источник / обновлено"
            value={financials.source === 'statement' ? 'Выписка' : 'Вручную'}
            hint={financials.updatedAt ? formatDateTime(financials.updatedAt) : undefined}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              Компания
            </Typography>
            <form onSubmit={companyForm.handleSubmit(onSaveCompany)}>
              <Stack spacing={2}>
                <TextField
                  label="Название"
                  fullWidth
                  {...companyForm.register('name')}
                  error={!!companyForm.formState.errors.name}
                  helperText={companyForm.formState.errors.name?.message}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="ИНН"
                    fullWidth
                    {...companyForm.register('inn')}
                    error={!!companyForm.formState.errors.inn}
                    helperText={companyForm.formState.errors.inn?.message}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="ОГРН / ОГРНИП"
                    fullWidth
                    {...companyForm.register('ogrn')}
                    error={!!companyForm.formState.errors.ogrn}
                    helperText={companyForm.formState.errors.ogrn?.message}
                  />
                </Stack>
                <Controller
                  name="legalForm"
                  control={companyForm.control}
                  render={({ field }) => (
                    <TextField select label="Форма" fullWidth {...field} disabled>
                      <MenuItem value="IP">ИП</MenuItem>
                      <MenuItem value="OOO">ООО</MenuItem>
                    </TextField>
                  )}
                />
                <Controller
                  name="industry"
                  control={companyForm.control}
                  render={({ field }) => (
                    <TextField select label="Отрасль" fullWidth {...field}>
                      {industries.map((i) => (
                        <MenuItem key={i} value={i}>
                          {i}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name="region"
                  control={companyForm.control}
                  render={({ field }) => (
                    <TextField select label="Регион" fullWidth {...field}>
                      {regions.map((r) => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Дата регистрации"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    {...companyForm.register('registrationDate')}
                  />
                  <TextField
                    label="Сотрудники"
                    type="number"
                    fullWidth
                    {...companyForm.register('employeesCount')}
                  />
                </Stack>
                <Button type="submit" variant="contained">
                  Сохранить компанию
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5 }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              Финансы
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Период: {financials.period}. Можно заполнить вручную или импортировать из выписки.
            </Typography>
            <form onSubmit={finForm.handleSubmit(onSaveFin)}>
              <Stack spacing={2}>
                <TextField label="Период (YYYY-MM)" fullWidth {...finForm.register('period')} />
                <TextField
                  label="Среднемесячная выручка, ₽"
                  type="number"
                  fullWidth
                  {...finForm.register('avgMonthlyRevenue')}
                />
                <TextField
                  label="Операционные расходы, ₽"
                  type="number"
                  fullWidth
                  {...finForm.register('operatingExpenses')}
                />
                <TextField
                  label="Остатки на счетах, ₽"
                  type="number"
                  fullWidth
                  {...finForm.register('cashBalance')}
                />
                <TextField
                  label="Обязательства, ₽"
                  type="number"
                  fullWidth
                  {...finForm.register('liabilities')}
                />
                <TextField
                  label="Действующие кредиты (остаток), ₽"
                  type="number"
                  fullWidth
                  {...finForm.register('activeCredits')}
                />
                <Stack direction="row" spacing={1}>
                  <Button type="submit" variant="contained">
                    Сохранить финансы
                  </Button>
                  <Button component={RouterLink} to="/app/statements" variant="outlined">
                    Загрузить выписку
                  </Button>
                </Stack>
              </Stack>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
