import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import ClearIcon from '@mui/icons-material/Clear'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { createCompany, getCompany, updateCompany } from '@/api/companies'
import { LegalFormToggle } from '@/components/onboarding/LegalFormToggle'
import { OnboardingShell, WhyNeededSidebar } from '@/components/onboarding/OnboardingShell'
import { useAuth } from '@/contexts/AuthContext'
import { industries, regions } from '@/data/labels'
import type { LegalForm } from '@/types'

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

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
  },
}

const schema = z
  .object({
    legalForm: z.enum(['IP', 'OOO']),
    inn: z.string().regex(/^\d{10}(\d{2})?$/, 'ИНН: 10 цифр (ООО) или 12 (ИП)'),
    name: z.string().min(2, 'Укажите название или ФИО'),
    industry: z.string().min(1, 'Выберите сферу'),
    region: z.string().min(1, 'Выберите регион'),
    registrationDate: z.string().min(1, 'Укажите дату'),
  })
  .superRefine((val, ctx) => {
    const need = val.legalForm === 'IP' ? 12 : 10
    if (val.inn.length !== need) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inn'],
        message: val.legalForm === 'IP' ? 'Для ИП нужно 12 цифр ИНН' : 'Для ООО нужно 10 цифр ИНН',
      })
    }
  })

type FormValues = z.infer<typeof schema>

function toInputDate(isoOrRu: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrRu)) return isoOrRu
  const m = isoOrRu.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return isoOrRu
}

export function CompanyCreatePage() {
  const { user, isAuthenticated, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const companyId = user?.companyId

  const companyQ = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: Boolean(companyId),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalForm: 'OOO',
      inn: '',
      name: '',
      industry: industries.includes('Общественное питание')
        ? 'Общественное питание'
        : industries[0] ?? '',
      region: regions[0] ?? 'Москва',
      registrationDate: '2019-03-12',
    },
  })

  const legalForm = form.watch('legalForm')

  useEffect(() => {
    const inn = form.getValues('inn')
    const max = legalForm === 'IP' ? 12 : 10
    if (inn.length > max) form.setValue('inn', inn.slice(0, max))
  }, [legalForm, form])

  useEffect(() => {
    if (!companyQ.data) return
    const c = companyQ.data
    form.reset({
      legalForm: c.legalForm,
      inn: c.inn,
      name: c.name,
      industry: c.industry,
      region: c.region,
      registrationDate: c.registrationDate.slice(0, 10),
    })
  }, [companyQ.data, form])

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'manager' || user.role === 'risk_analyst' || user.role === 'admin') {
    return <Navigate to="/app/manager" replace />
  }

  if (companyId && companyQ.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  async function onSubmit(values: FormValues) {
    setError(null)
    setLoading(true)
    try {
      if (companyId) {
        await updateCompany(companyId, {
          name: values.name.trim(),
          industry: values.industry,
          region: values.region,
          registrationDate: toInputDate(values.registrationDate),
        })
      } else {
        await createCompany({
          inn: values.inn,
          name: values.name.trim(),
          legalForm: values.legalForm as LegalForm,
          industry: values.industry,
          region: values.region,
          registrationDate: toInputDate(values.registrationDate),
          employeesCount: 1,
        })
        await refreshUser()
      }
      navigate('/onboarding/finances')
    } catch (e) {
      setError(apiError(e, 'Не удалось сохранить компанию'))
    } finally {
      setLoading(false)
    }
  }

  const nameLabel = legalForm === 'IP' ? 'ФИО предпринимателя' : 'Название компании'
  const dateLabel =
    legalForm === 'IP' ? 'Дата регистрации в качестве ИП' : 'Дата регистрации компании'
  const innMax = legalForm === 'IP' ? 12 : 10

  return (
    <OnboardingShell step={1} title="Расскажите о компании" sidebar={<WhyNeededSidebar />}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Controller
          name="legalForm"
          control={form.control}
          render={({ field }) => (
            <LegalFormToggle
              value={field.value}
              onChange={companyId ? () => undefined : field.onChange}
            />
          )}
        />

        <Stack spacing={2}>
          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}

          <Controller
            name="inn"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="ИНН"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                disabled={Boolean(companyId)}
                onChange={(e) =>
                  field.onChange(e.target.value.replace(/\D/g, '').slice(0, innMax))
                }
                InputProps={{
                  endAdornment:
                    field.value && !companyId ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => field.onChange('')} edge="end">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                }}
                sx={fieldSx}
              />
            )}
          />

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={nameLabel}
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  endAdornment: field.value ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => field.onChange('')} edge="end">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                }}
                sx={fieldSx}
              />
            )}
          />

          <Controller
            name="industry"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Сфера деятельности"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={fieldSx}
              >
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
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Регион"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={fieldSx}
              >
                {regions.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Controller
            name="registrationDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={dateLabel}
                type="date"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <CalendarTodayOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            )}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            endIcon={<ArrowForwardIcon />}
            sx={{
              mt: 1,
              py: 1.45,
              borderRadius: 2,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {loading ? 'Сохраняем…' : 'Продолжить'}
          </Button>
        </Stack>
      </form>
    </OnboardingShell>
  )
}
