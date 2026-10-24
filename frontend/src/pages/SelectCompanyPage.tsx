import AddRoundedIcon from '@mui/icons-material/AddRounded'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createCompany,
  getCompanyDashboard,
  listCompanies,
  lookupCompanyByInn,
} from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'
import type { CompanyListItem, MemberRole, RegistryCompany } from '@/types'
import { formatDate } from '@/utils/format'

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

function maskInn(inn: string, full: boolean): string {
  if (full || inn.length < 4) return inn
  return `•••• ${inn.slice(-4)}`
}

function roleLabel(role?: MemberRole): string {
  if (role === 'OWNER') return 'Владелец'
  if (role === 'VIEWER') return 'Просмотр'
  if (role === 'MEMBER') return 'Участник'
  return 'Все'
}

type RoleFilter = 'ALL' | MemberRole

export function SelectCompanyPage() {
  const { user, logout, selectCompany } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const forceEmpty = searchParams.get('empty') === '1'

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [inn, setInn] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [found, setFound] = useState<RegistryCompany | null>(null)

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  })

  const companies = forceEmpty ? [] : (companiesQ.data ?? [])
  const isEmpty = forceEmpty || (!companiesQ.isLoading && companies.length === 0)

  useEffect(() => {
    if (!companies.length) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => {
      if (prev && companies.some((c) => c.id === prev)) return prev
      if (user?.companyId && companies.some((c) => c.id === user.companyId)) return user.companyId
      return companies[0].id
    })
  }, [companies, user?.companyId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return companies.filter((c) => {
      if (roleFilter !== 'ALL' && c.membershipRole !== roleFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.inn.includes(q)
    })
  }, [companies, query, roleFilter])

  const selected = companies.find((c) => c.id === selectedId) ?? null

  const dashQ = useQuery({
    queryKey: ['company-dashboard', selected?.id],
    queryFn: () => getCompanyDashboard(selected!.id),
    enabled: Boolean(selected?.id),
  })

  const lookupMut = useMutation({
    mutationFn: (value: string) => lookupCompanyByInn(value),
    onSuccess: (res) => {
      setLookupError(null)
      if (!res.innValid) {
        setFound(null)
        setLookupError('ИНН не проходит проверку контрольной суммы')
        return
      }
      if (!res.found || !res.company) {
        setFound(null)
        setLookupError('Компания не найдена в реестре. Можно создать вручную.')
        return
      }
      if (res.company.registryStatus === 'LIQUIDATED') {
        setFound(null)
        setLookupError('Компания ликвидирована — добавить нельзя')
        return
      }
      setFound(res.company)
    },
    onError: (err) => {
      setFound(null)
      setLookupError(apiError(err, 'Не удалось найти компанию'))
    },
  })

  const createMut = useMutation({
    mutationFn: async (reg: RegistryCompany) => {
      const company = await createCompany({
        inn: reg.inn,
        name: reg.name,
        legalForm: reg.legalForm,
        industry: 'Не указано',
        registrationDate: reg.registrationDate,
        region: reg.region,
        employeesCount: 1,
      })
      return company
    },
    onSuccess: async (company) => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      setSelectedId(company.id)
      setAdding(false)
      setInn('')
      setFound(null)
      setLookupError(null)
      selectCompany(company.id)
      // leave empty preview / first-visit → filled select or cabinet
      navigate('/select-company', { replace: true })
    },
    onError: (err) => setLookupError(apiError(err, 'Не удалось добавить компанию')),
  })

  function onLookup() {
    const digits = inn.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 12) {
      setLookupError('ИНН: 10 цифр (ООО) или 12 (ИП)')
      return
    }
    lookupMut.mutate(digits)
  }

  function onContinue() {
    if (!selected) return
    selectCompany(selected.id)
    navigate('/app')
  }

  function onLogout() {
    logout()
    navigate('/login')
  }

  const showAddPanel = adding

  if (!forceEmpty && companiesQ.isLoading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#F3F5F8',
        }}
      >
        <CircularProgress size={32} sx={{ color: '#EF3124' }} />
      </Box>
    )
  }

  if (isEmpty) {
    return (
      <FirstVisitEmpty
        userName={user?.fullName || 'пользователь'}
        inn={inn}
        onInnChange={(v) => {
          setInn(v.replace(/\D/g, '').slice(0, 12))
          setFound(null)
          setLookupError(null)
        }}
        lookupError={lookupError}
        found={found}
        looking={lookupMut.isPending}
        creating={createMut.isPending}
        onLookup={onLookup}
        onConfirm={() => found && createMut.mutate(found)}
        onManual={() => navigate('/onboarding/company')}
        onLogout={onLogout}
      />
    )
  }

  return (
    <Box
      sx={{
        height: '100vh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#F3F5F8',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          px: { xs: 2, md: 3, lg: 4 },
          py: { xs: 2, md: 2.5 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.25fr 0.75fr' },
          gap: { xs: 2, md: 2.5 },
          maxWidth: 1180,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Left */}
        <Box
          sx={{
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 24, md: 28 },
                letterSpacing: '-0.03em',
                color: '#0B1F35',
                lineHeight: 1.15,
              }}
            >
              Выберите компанию
            </Typography>
            <Typography sx={{ color: '#5A6B7D', fontSize: 14, mt: 0.75, lineHeight: 1.4 }}>
              Вошли как {user?.fullName || 'пользователь'} · данные и заявки показываются в разрезе
              выбранной компании
            </Typography>
          </Box>

          <Box
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'stretch',
                gap: 1.25,
              }}
            >
              <TextField
                placeholder="Поиск по названию или ИНН"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: '#8A96A3', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  '& .MuiOutlinedInput-root': {
                    height: 48,
                    borderRadius: 2.5,
                    bgcolor: '#fff',
                    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(11,31,53,0.22)' },
                    '&.Mui-focused fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 0,
                    fontSize: 14,
                  },
                }}
              />
              <TextField
                select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (v) => {
                    const val = v as RoleFilter
                    if (val === 'ALL') return 'Роль: Все'
                    return roleLabel(val)
                  },
                }}
                sx={{
                  width: { xs: 128, sm: 152 },
                  flexShrink: 0,
                  '& .MuiOutlinedInput-root': {
                    height: 48,
                    borderRadius: 2.5,
                    bgcolor: '#fff',
                    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(11,31,53,0.22)' },
                    '&.Mui-focused fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
                  },
                  '& .MuiSelect-select': {
                    py: 0,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0B1F35',
                  },
                }}
              >
                <MenuItem value="ALL">Все</MenuItem>
                <MenuItem value="OWNER">Владелец</MenuItem>
                <MenuItem value="MEMBER">Участник</MenuItem>
                <MenuItem value="VIEWER">Просмотр</MenuItem>
              </TextField>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.75,
              pr: 0.25,
              pb: 0.5,
            }}
          >
            {companiesQ.isError && (
              <Alert severity="error" sx={{ borderRadius: 2.5 }}>
                {apiError(companiesQ.error, 'Не удалось загрузить компании')}
              </Alert>
            )}

            {!companiesQ.isError &&
              filtered.map((item) => (
                <CompanyCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={() => {
                    setSelectedId(item.id)
                    setAdding(false)
                  }}
                  onContinue={() => {
                    setSelectedId(item.id)
                    selectCompany(item.id)
                    navigate('/app')
                  }}
                />
              ))}

            {filtered.length === 0 && (
              <Box
                sx={{
                  bgcolor: '#fff',
                  borderRadius: 3,
                  p: 3,
                  textAlign: 'center',
                  color: '#5A6B7D',
                  fontSize: 14,
                }}
              >
                Ничего не найдено по запросу
              </Box>
            )}

            {showAddPanel ? (
              <AddByInnPanel
                inn={inn}
                onInnChange={(v) => {
                  setInn(v.replace(/\D/g, '').slice(0, 12))
                  setFound(null)
                  setLookupError(null)
                }}
                lookupError={lookupError}
                found={found}
                looking={lookupMut.isPending}
                creating={createMut.isPending}
                onLookup={onLookup}
                onConfirm={() => found && createMut.mutate(found)}
                onManual={() => navigate('/onboarding/company')}
                onCancel={() => {
                  setAdding(false)
                  setInn('')
                  setFound(null)
                  setLookupError(null)
                }}
              />
            ) : (
              <Box
                component="button"
                type="button"
                onClick={() => setAdding(true)}
                sx={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  margin: 0,
                  font: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 2,
                  bgcolor: '#fff',
                  borderRadius: 3.5,
                  p: 2.5,
                  border: '1.5px dashed rgba(239,49,36,0.4)',
                  '&:hover': { bgcolor: 'rgba(239,49,36,0.03)', borderColor: '#EF3124' },
                }}
              >
                <Stack direction="row" spacing={1.75} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(239,49,36,0.08)',
                      color: '#EF3124',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AddRoundedIcon />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
                      Добавить компанию по ИНН
                    </Typography>
                    <Typography sx={{ color: '#8A96A3', fontSize: 13, mt: 0.35 }}>
                      Найдём в реестре и подтвердим доступ
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>

          <Button
            onClick={onLogout}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              flexShrink: 0,
              color: '#5A6B7D',
              fontWeight: 600,
              alignSelf: 'center',
            }}
          >
            Выйти из аккаунта
          </Button>
        </Box>

        {/* Right preview — desktop only */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, minHeight: 0 }}>
          <PreviewPanel
            selected={selected}
            dash={dashQ.data}
            dashLoading={dashQ.isLoading}
            onContinue={onContinue}
            onLogout={onLogout}
          />
        </Box>
      </Box>
    </Box>
  )
}

function CompanyCard({
  item,
  selected,
  onSelect,
  onContinue,
}: {
  item: CompanyListItem
  selected: boolean
  onSelect: () => void
  onContinue: () => void
}) {
  const isOOO = item.legalForm === 'OOO'
  const formLabel = isOOO ? 'ООО' : 'ИП'
  const meta = [
    `ИНН ${maskInn(item.inn, selected)}`,
    formLabel,
    item.region || null,
    item.membershipRole ? roleLabel(item.membershipRole) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box
      onClick={onSelect}
      sx={{
        bgcolor: '#fff',
        borderRadius: 3.5,
        p: { xs: 2.25, md: 2.5 },
        border: selected ? '1.5px solid #EF3124' : '1.5px solid rgba(11,31,53,0.08)',
        boxShadow: selected
          ? '0 0 0 3px rgba(239,49,36,0.1), 0 8px 24px rgba(11,31,53,0.06)'
          : '0 2px 10px rgba(11,31,53,0.04)',
        cursor: 'pointer',
        transition: 'border 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: selected ? '#EF3124' : 'rgba(11,31,53,0.16)',
        },
      }}
    >
      <Stack direction="row" spacing={1.75} alignItems="flex-start">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: selected ? 'rgba(239,49,36,0.1)' : '#EEF1F5',
            color: selected ? '#EF3124' : '#5A6B7D',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {isOOO ? (
            <BusinessOutlinedIcon sx={{ fontSize: 24 }} />
          ) : (
            <PersonOutlineRoundedIcon sx={{ fontSize: 24 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 16, md: 17 },
              letterSpacing: '-0.02em',
              color: '#0B1F35',
              lineHeight: 1.25,
              mb: 0.5,
            }}
          >
            {item.name}
          </Typography>
          <Typography sx={{ color: '#8A96A3', fontSize: 13, lineHeight: 1.4 }}>
            {meta}
          </Typography>
        </Box>
      </Stack>

      <Button
        variant={selected ? 'contained' : 'outlined'}
        color={selected ? 'primary' : 'inherit'}
        fullWidth
        onClick={(e) => {
          e.stopPropagation()
          if (selected) onContinue()
          else onSelect()
        }}
        sx={{
          mt: 2.25,
          borderRadius: 2.5,
          py: 1.25,
          fontWeight: 700,
          fontSize: 15,
          ...(selected
            ? {}
            : {
                borderColor: 'rgba(11,31,53,0.18)',
                color: '#0B1F35',
                bgcolor: '#fff',
                '&:hover': { borderColor: '#0B1F35', bgcolor: '#F7F8FA' },
              }),
        }}
      >
        {selected ? 'Продолжить' : 'Открыть'}
      </Button>
    </Box>
  )
}

/** First login: no companies yet — one-viewport onboarding */
function FirstVisitEmpty({
  userName,
  inn,
  onInnChange,
  lookupError,
  found,
  looking,
  creating,
  onLookup,
  onConfirm,
  onManual,
  onLogout,
}: {
  userName: string
  inn: string
  onInnChange: (v: string) => void
  lookupError: string | null
  found: RegistryCompany | null
  looking: boolean
  creating: boolean
  onLookup: () => void
  onConfirm: () => void
  onManual: () => void
  onLogout: () => void
}) {
  const steps = [
    { n: '1', title: 'Найдите по ИНН', body: '10 цифр для ООО или 12 для ИП' },
    { n: '2', title: 'Подтвердите карточку', body: 'Сверим данные с реестром' },
    { n: '3', title: 'Откройте кабинет', body: 'Подбор кредита и заявка' },
  ]

  const perks = [
    {
      Icon: ChecklistRtlOutlinedIcon,
      title: 'Подбор под цель',
      body: 'Оборот, точка, оборудование — сравнение условий',
    },
    {
      Icon: ShowChartOutlinedIcon,
      title: 'Прогноз cash flow',
      body: 'Увидите нагрузку платежа до подачи заявки',
    },
    {
      Icon: BusinessOutlinedIcon,
      title: 'Заявка менеджеру',
      body: 'Документы и статус в одном месте',
    },
  ]

  return (
    <Box
      sx={{
        height: '100vh',
        maxHeight: '100dvh',
        bgcolor: '#F3F5F8',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          maxWidth: 1100,
          width: '100%',
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: { xs: 2.5, md: 3.5 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          gap: { xs: 2, md: 3 },
          alignItems: 'stretch',
        }}
      >
        {/* Primary: INN */}
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 4,
            p: { xs: 2.5, md: 3.5 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            boxShadow: '0 8px 32px rgba(11,31,53,0.07)',
            border: '1px solid rgba(11,31,53,0.05)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2.5,
              bgcolor: 'rgba(239,49,36,0.08)',
              color: '#EF3124',
              display: 'grid',
              placeItems: 'center',
              mb: 2,
              flexShrink: 0,
            }}
          >
            <BusinessOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>

          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 32 },
              letterSpacing: '-0.035em',
              color: '#0B1F35',
              lineHeight: 1.12,
              mb: 1,
            }}
          >
            Добавьте первую компанию
          </Typography>
          <Typography sx={{ color: '#5A6B7D', fontSize: 15, lineHeight: 1.45, mb: 2.5, maxWidth: 420 }}>
            Здравствуйте, {userName.trim().split(/\s+/)[0] || 'коллега'}! Чтобы открыть кабинет,
            найдите организацию или ИП по ИНН — займёт меньше минуты.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }}>
            <TextField
              label="ИНН компании или ИП"
              value={inn}
              onChange={(e) => onInnChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLookup()}
              placeholder="Например, 7707083893"
              fullWidth
              autoFocus
              inputProps={{ inputMode: 'numeric', maxLength: 12, 'aria-label': 'ИНН' }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  bgcolor: '#F7F8FA',
                  '& fieldset': { borderColor: 'rgba(11,31,53,0.1)' },
                  '&.Mui-focused': { bgcolor: '#fff' },
                  '&.Mui-focused fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
                },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={onLookup}
              disabled={looking || inn.length < 10}
              sx={{
                borderRadius: 2.5,
                px: 3.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                minHeight: 56,
                flexShrink: 0,
                fontSize: 15,
              }}
            >
              {looking ? <CircularProgress size={22} color="inherit" /> : 'Найти в реестре'}
            </Button>
          </Stack>

          {lookupError && (
            <Alert
              severity="warning"
              sx={{ mb: 1.5, borderRadius: 2.5 }}
              action={
                lookupError.includes('вручную') ? (
                  <Button color="inherit" size="small" onClick={onManual} sx={{ fontWeight: 700 }}>
                    Вручную
                  </Button>
                ) : undefined
              }
            >
              {lookupError}
            </Alert>
          )}

          {found && (
            <Box
              sx={{
                bgcolor: '#F7F8FA',
                borderRadius: 3,
                p: 2.25,
                mb: 2,
                border: '1.5px solid rgba(239,49,36,0.2)',
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#EF3124', mb: 0.75 }}>
                Найдено в реестре
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#0B1F35', mb: 0.5 }}>
                {found.name}
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#5A6B7D', lineHeight: 1.45, mb: 2 }}>
                ИНН {found.inn} · {found.legalForm === 'IP' ? 'ИП' : 'ООО'} · {found.region}
                <br />
                Дата регистрации: {formatDate(found.registrationDate)}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                disabled={creating}
                onClick={onConfirm}
                sx={{ borderRadius: 2.5, fontWeight: 700, py: 1.35 }}
              >
                {creating ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  'Это моя компания — продолжить'
                )}
              </Button>
            </Box>
          )}

          <Box
            sx={{
              mt: 'auto',
              pt: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.25,
            }}
          >
            {steps.map((s) => (
              <Box
                key={s.n}
                sx={{
                  bgcolor: '#F7F8FA',
                  borderRadius: 2.5,
                  p: { xs: 1.25, md: 1.5 },
                  minWidth: 0,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 18,
                    color: '#EF3124',
                    lineHeight: 1,
                    mb: 0.75,
                  }}
                >
                  {s.n}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: 12, md: 13 },
                    color: '#0B1F35',
                    lineHeight: 1.25,
                    mb: 0.35,
                  }}
                >
                  {s.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: '#8A96A3',
                    lineHeight: 1.35,
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  {s.body}
                </Typography>
              </Box>
            ))}
          </Box>

          <Button
            variant="text"
            onClick={onLogout}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              mt: 1.5,
              color: '#5A6B7D',
              fontWeight: 600,
              alignSelf: 'center',
            }}
          >
            Выйти из аккаунта
          </Button>
        </Box>

        {/* Secondary: value + logout — desktop */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            minHeight: 0,
            gap: 2,
          }}
        >
          <Box
            sx={{
              flex: 1,
              bgcolor: '#0B1F35',
              borderRadius: 4,
              p: { xs: 2.5, md: 3.5 },
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              backgroundImage:
                'radial-gradient(600px 280px at 100% 0%, rgba(239,49,36,0.35), transparent 55%)',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 20, md: 22 },
                letterSpacing: '-0.02em',
                mb: 0.75,
              }}
            >
              После добавления
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, mb: 3, lineHeight: 1.45 }}>
              Кабинет откроется сразу — без лишних шагов регистрации
            </Typography>

            <Stack spacing={2} sx={{ flex: 1 }}>
              {perks.map(({ Icon, title, body }) => (
                <Stack key={title} direction="row" spacing={1.75} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: '#FF8A80',
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.25 }}>{title}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', lineHeight: 1.4 }}>
                      {body}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Button
            variant="outlined"
            onClick={onLogout}
            fullWidth
            sx={{
              borderRadius: 2.5,
              py: 1.25,
              borderColor: 'rgba(11,31,53,0.18)',
              bgcolor: '#fff',
              color: '#0B1F35',
              fontWeight: 600,
              flexShrink: 0,
              '&:hover': { borderColor: '#0B1F35', bgcolor: '#fff' },
            }}
          >
            Выйти из аккаунта
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

function AddByInnPanel({
  inn,
  onInnChange,
  lookupError,
  found,
  looking,
  creating,
  onLookup,
  onConfirm,
  onManual,
  onCancel,
}: {
  inn: string
  onInnChange: (v: string) => void
  lookupError: string | null
  found: RegistryCompany | null
  looking: boolean
  creating: boolean
  onLookup: () => void
  onConfirm: () => void
  onManual: () => void
  onCancel?: () => void
}) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: 3,
        p: { xs: 2.5, md: 3 },
        border: '1.5px dashed rgba(239,49,36,0.35)',
        flexShrink: 0,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'rgba(239,49,36,0.08)',
            color: '#EF3124',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <AddRoundedIcon />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
            Добавить компанию по ИНН
          </Typography>
          <Typography sx={{ color: '#8A96A3', fontSize: 13, mt: 0.35, lineHeight: 1.4 }}>
            Введите ИНН — найдём карточку в реестре и предложим подтвердить доступ
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }}>
        <TextField
          label="ИНН"
          value={inn}
          onChange={(e) => onInnChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLookup()}
          placeholder="10 или 12 цифр"
          fullWidth
          inputProps={{ inputMode: 'numeric', maxLength: 12 }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={onLookup}
          disabled={looking || inn.length < 10}
          sx={{
            borderRadius: 2,
            px: 3,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            minHeight: 56,
            flexShrink: 0,
          }}
        >
          {looking ? <CircularProgress size={20} color="inherit" /> : 'Найти'}
        </Button>
      </Stack>

      {lookupError && (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, borderRadius: 2 }}
          action={
            lookupError.includes('вручную') ? (
              <Button color="inherit" size="small" onClick={onManual}>
                Создать
              </Button>
            ) : undefined
          }
        >
          {lookupError}
        </Alert>
      )}

      {found && (
        <Box
          sx={{
            bgcolor: '#F7F8FA',
            borderRadius: 2.5,
            p: 2,
            mb: 1.5,
            border: '1px solid rgba(11,31,53,0.06)',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0B1F35', mb: 0.5 }}>
            {found.name}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#5A6B7D', lineHeight: 1.45 }}>
            ИНН {found.inn} · {found.legalForm === 'IP' ? 'ИП' : 'ООО'} · {found.region}
            <br />
            Регистрация: {formatDate(found.registrationDate)}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            disabled={creating}
            onClick={onConfirm}
            sx={{ mt: 2, borderRadius: 2, fontWeight: 700, py: 1.2 }}
          >
            {creating ? <CircularProgress size={20} color="inherit" /> : 'Подтвердить и добавить'}
          </Button>
        </Box>
      )}

      {onCancel && (
        <Button onClick={onCancel} sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Отмена
        </Button>
      )}
    </Box>
  )
}

function PreviewPanel({
  selected,
  dash,
  dashLoading,
  onContinue,
  onLogout,
}: {
  selected: CompanyListItem | null
  dash: Awaited<ReturnType<typeof getCompanyDashboard>> | undefined
  dashLoading: boolean
  onContinue: () => void
  onLogout: () => void
}) {
  if (!selected) return null

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: 3.5,
        p: { xs: 2.5, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        boxShadow: '0 4px 24px rgba(11,31,53,0.06)',
        border: '1px solid rgba(11,31,53,0.05)',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: 18, md: 20 },
          letterSpacing: '-0.02em',
          color: '#0B1F35',
          mb: 2,
          flexShrink: 0,
        }}
      >
        Что вас ждёт в кабинете
      </Typography>

      <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
        {(
          [
            { k: 'Компания', v: selected.name },
            {
              k: 'Активные заявки',
              v: dashLoading ? '…' : String(dash?.applicationsActive ?? 0),
            },
            { k: 'Регион', v: selected.region || '—' },
            { k: 'Роль', v: roleLabel(selected.membershipRole) },
          ] as const
        ).map((row) => (
          <Stack
            key={row.k}
            direction="row"
            justifyContent="space-between"
            sx={{
              py: 1.35,
              borderBottom: '1px solid rgba(11,31,53,0.06)',
              gap: 2,
            }}
          >
            <Typography sx={{ color: '#8A96A3', fontSize: 14, flexShrink: 0 }}>{row.k}</Typography>
            <Typography
              sx={{
                color: '#0B1F35',
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.v}
            </Typography>
          </Stack>
        ))}

        {dash?.nextTaskTitle && (
          <Box
            sx={{
              mt: 2,
              bgcolor: '#FCE8E6',
              borderRadius: 2.5,
              p: 1.75,
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
            }}
          >
            <WarningAmberRoundedIcon sx={{ color: '#EF3124', fontSize: 20, mt: 0.15 }} />
            <Typography sx={{ fontSize: 13, color: '#5A2A26', lineHeight: 1.4 }}>
              {dash.nextTaskTitle}
              {dash.nextTaskDue ? ` — до ${formatDate(dash.nextTaskDue)}` : ''}
            </Typography>
          </Box>
        )}

        {!dash?.nextTaskTitle && dash && dash.applicationsTotal === 0 && (
          <Box sx={{ mt: 2, bgcolor: '#F7F8FA', borderRadius: 2.5, p: 1.75 }}>
            <Typography sx={{ fontSize: 13, color: '#5A6B7D', lineHeight: 1.4 }}>
              Активных задач нет. Можно перейти к подбору продукта и заявке.
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 'auto', pt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={onContinue}
            sx={{ borderRadius: 2.5, py: 1.45, fontWeight: 700, fontSize: 15 }}
          >
            Продолжить
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={onLogout}
            sx={{
              borderRadius: 2.5,
              py: 1.25,
              borderColor: 'rgba(11,31,53,0.18)',
              color: '#0B1F35',
              fontWeight: 600,
            }}
          >
            Выйти из аккаунта
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}
