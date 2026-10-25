import AddRoundedIcon from '@mui/icons-material/AddRounded'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createCompany,
  getCompanyDashboard,
  listCompanies,
  lookupCompanyByInn,
} from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'
import { LogoutConfirmDialog } from '@/components/common/LogoutConfirmDialog'
import { IncomingInvitesCard } from '@/components/team/IncomingInvitesCard'
import { InviteAcceptPage } from '@/pages/InviteAcceptPage'
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

function registryStatusLabel(status: string): string {
  if (status === 'ACTIVE') return 'Действующий'
  if (status === 'LIQUIDATED') return 'Ликвидирован'
  return status
}

type RoleFilter = 'ALL' | MemberRole

export function SelectCompanyPage() {
  const [searchParams] = useSearchParams()
  // Ссылка из «Пригласить сотрудника»: ?invite=&company=&role=
  if (searchParams.get('invite')) {
    return <InviteAcceptPage />
  }
  return <SelectCompanyChooser />
}

function SelectCompanyChooser() {
  const { logout, selectCompany } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [inn, setInn] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [found, setFound] = useState<RegistryCompany | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  })

  const companies = companiesQ.data ?? []
  // Don't treat API errors as "no companies" — that wrongly opens first-visit INN screen
  const isEmpty =
    !companiesQ.isLoading && !companiesQ.isError && companies.length === 0

  // Drop selection only if company disappeared — never auto-open preview
  useEffect(() => {
    if (!selectedId) return
    if (!companies.some((c) => c.id === selectedId)) setSelectedId(null)
  }, [companies, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return companies.filter((c) => {
      if (roleFilter !== 'ALL' && c.membershipRole !== roleFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.inn.includes(q)
    })
  }, [companies, query, roleFilter])

  const selected = companies.find((c) => c.id === selectedId) ?? null
  const detailOpen = Boolean(selected)

  const dashQ = useQuery({
    queryKey: ['company-dashboard', selected?.id],
    queryFn: () => getCompanyDashboard(selected!.id),
    enabled: Boolean(selected?.id),
  })

  function openDetails(id: string) {
    setSelectedId(id)
    setAdding(false)
  }

  function closeDetails() {
    setSelectedId(null)
  }

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
        ogrn: reg.ogrn,
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
      navigate('/app', { replace: true })
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
    setLogoutOpen(true)
  }

  function confirmLogout() {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  const showAddPanel = adding

  if (companiesQ.isLoading) {
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

  if (companiesQ.isError) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#F3F5F8',
          px: 2,
        }}
      >
        <Alert
          severity="error"
          sx={{ maxWidth: 420, borderRadius: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => companiesQ.refetch()}>
              Повторить
            </Button>
          }
        >
          Не удалось загрузить компании. Проверьте вход и бэкенд.
        </Alert>
      </Box>
    )
  }

  function onInviteAccepted(companyId?: string) {
    if (companyId) selectCompany(companyId)
    navigate('/app')
  }

  if (isEmpty) {
    return (
      <FirstVisitEmpty
        inn={inn}
        onInnChange={(v) => {
          setInn(v.replace(/\D/g, '').slice(0, 12))
          setFound(null)
          setLookupError(null)
        }}
        onClear={() => {
          setInn('')
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
        invitesSlot={<IncomingInvitesCard onAccepted={onInviteAccepted} />}
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
          <IncomingInvitesCard onAccepted={onInviteAccepted} sx={{ flexShrink: 0 }} />

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
              Откройте нужную организацию или добавьте новую по ИНН
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
            {filtered.map((item) => (
              <CompanyCard
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onDetails={() => openDetails(item.id)}
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

        {/* Right preview — desktop only, only after «Подробнее» */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, minHeight: 0 }}>
          {detailOpen && selected ? (
            <PreviewPanel
              key={selected.id}
              selected={selected}
              dash={dashQ.data}
              dashLoading={dashQ.isLoading || (dashQ.isFetching && !dashQ.data)}
              onContinue={onContinue}
              onClose={closeDetails}
              onLogout={onLogout}
            />
          ) : (
            <PreviewPlaceholder />
          )}
        </Box>
      </Box>

      {/* Mobile: details as bottom sheet */}
      <Drawer
        anchor="bottom"
        open={isMobile && detailOpen}
        onClose={closeDetails}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '88dvh',
            bgcolor: '#F3F5F8',
            p: 2,
          },
        }}
      >
        {selected && (
          <PreviewPanel
            key={selected.id}
            selected={selected}
            dash={dashQ.data}
            dashLoading={dashQ.isLoading || (dashQ.isFetching && !dashQ.data)}
            onContinue={onContinue}
            onClose={closeDetails}
            onLogout={onLogout}
          />
        )}
      </Drawer>

      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </Box>
  )
}

function CompanyCard({
  item,
  selected,
  onDetails,
}: {
  item: CompanyListItem
  selected: boolean
  onDetails: () => void
}) {
  const isOOO = item.legalForm === 'OOO'
  const meta = `ИНН ${maskInn(item.inn, selected)}`

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: 3.5,
        p: { xs: 2.25, md: 2.5 },
        border: selected ? '1.5px solid #EF3124' : '1.5px solid rgba(11,31,53,0.08)',
        boxShadow: selected
          ? '0 0 0 3px rgba(239,49,36,0.1), 0 8px 24px rgba(11,31,53,0.06)'
          : '0 2px 10px rgba(11,31,53,0.04)',
        transition: 'border 0.15s, box-shadow 0.15s',
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
        onClick={onDetails}
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
        Подробнее
      </Button>
    </Box>
  )
}

function PreviewPlaceholder() {
  return (
    <Box
      sx={{
        flex: 1,
        width: '100%',
        borderRadius: 3.5,
        border: '1.5px dashed rgba(11,31,53,0.12)',
        bgcolor: 'rgba(255,255,255,0.55)',
        display: 'grid',
        placeItems: 'center',
        px: 3,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ color: '#8A96A3', fontSize: 14, lineHeight: 1.45, maxWidth: 220 }}>
        Нажмите «Подробнее» на карточке — справа откроется сводка по компании
      </Typography>
    </Box>
  )
}

/** First login: no companies yet — INN search + confirm access */
function FirstVisitEmpty({
  inn,
  onInnChange,
  onClear,
  lookupError,
  found,
  looking,
  creating,
  onLookup,
  onConfirm,
  onManual,
  onLogout,
  invitesSlot,
}: {
  inn: string
  onInnChange: (v: string) => void
  onClear: () => void
  lookupError: string | null
  found: RegistryCompany | null
  looking: boolean
  creating: boolean
  onLookup: () => void
  onConfirm: () => void
  onManual: () => void
  onLogout: () => void
  invitesSlot?: ReactNode
}) {
  const isOOO = found?.legalForm === 'OOO'
  const detailRows = found
    ? ([
        { k: 'Компания', v: found.name },
        {
          k: found.legalForm === 'IP' ? 'ОГРНИП' : 'ОГРН',
          v: found.ogrn || '—',
        },
        { k: 'Регион', v: found.region || '—' },
        { k: 'Статус в реестре', v: registryStatusLabel(found.registryStatus) },
        { k: 'Роль после добавления', v: 'Владелец' },
      ] as const)
    : []

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      height: 48,
      borderRadius: 2.5,
      bgcolor: '#fff',
      '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
      '&:hover fieldset': { borderColor: 'rgba(11,31,53,0.22)' },
      '&.Mui-focused fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
    },
    '& .MuiOutlinedInput-input': { py: 0, fontSize: 14 },
  } as const

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
          width: '100%',
          maxWidth: 1180,
          mx: 'auto',
          px: { xs: 2, md: 3, lg: 4 },
          py: { xs: 2.5, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 2.5 },
        }}
      >
          {invitesSlot}

          <Box sx={{ flexShrink: 0 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 26, md: 32 },
                letterSpacing: '-0.035em',
                color: '#0B1F35',
                lineHeight: 1.12,
              }}
            >
              Добавить компанию по ИНН
            </Typography>
            <Typography sx={{ color: '#5A6B7D', fontSize: 15, mt: 0.75, lineHeight: 1.4 }}>
              Найдём организацию в реестре и подтвердим доступ
            </Typography>
          </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 420px)' },
            gap: { xs: 2, md: 2.5 },
            alignItems: 'start',
            justifyContent: 'start',
          }}
        >
          {/* Left — compact search */}
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 3.5,
              p: { xs: 2, md: 2.25 },
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              boxShadow: '0 4px 24px rgba(11,31,53,0.06)',
              border: '1px solid rgba(11,31,53,0.05)',
              width: '100%',
            }}
          >
            <Typography sx={{ color: '#5A6B7D', fontSize: 13, fontWeight: 600 }}>
              ИНН организации*
            </Typography>
            <TextField
              value={inn}
              onChange={(e) => onInnChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLookup()}
              placeholder="Введите 10 или 12 цифр"
              fullWidth
              autoFocus
              inputProps={{ inputMode: 'numeric', maxLength: 12, 'aria-label': 'ИНН' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: '#8A96A3', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />

            <Stack direction="row" spacing={1.25}>
              <Button
                variant="contained"
                color="primary"
                onClick={onLookup}
                disabled={looking || inn.length < 10}
                sx={{
                  flex: 1.4,
                  borderRadius: 999,
                  py: 1.25,
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {looking ? <CircularProgress size={20} color="inherit" /> : 'Найти в реестре'}
              </Button>
              <Button
                variant="outlined"
                onClick={onClear}
                disabled={!inn && !found && !lookupError}
                sx={{
                  flex: 1,
                  borderRadius: 999,
                  py: 1.25,
                  borderColor: 'rgba(11,31,53,0.18)',
                  color: '#0B1F35',
                  fontWeight: 600,
                  bgcolor: '#fff',
                  fontSize: 14,
                  '&:hover': { borderColor: '#0B1F35', bgcolor: '#F7F8FA' },
                }}
              >
                Очистить
              </Button>
            </Stack>

            {lookupError && (
              <Alert
                severity="warning"
                sx={{ borderRadius: 2.5 }}
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
          </Box>

          {/* Right — compact holder, height by content */}
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 3.5,
              width: '100%',
              boxShadow: '0 4px 24px rgba(11,31,53,0.06)',
              border: '1px solid rgba(11,31,53,0.05)',
              p: { xs: 2, md: 2.25 },
              ...(found
                ? {}
                : {
                    minHeight: 200,
                    display: 'grid',
                    placeItems: 'center',
                  }),
            }}
          >
            {found ? (
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 17,
                    letterSpacing: '-0.02em',
                    color: '#0B1F35',
                    lineHeight: 1.2,
                    mb: 1.5,
                  }}
                >
                  Подробнее о компании
                </Typography>

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'rgba(239,49,36,0.1)',
                      color: '#EF3124',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isOOO ? (
                      <BusinessOutlinedIcon sx={{ fontSize: 20 }} />
                    ) : (
                      <PersonOutlineRoundedIcon sx={{ fontSize: 20 }} />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 800,
                        fontSize: 15,
                        color: '#0B1F35',
                        lineHeight: 1.25,
                      }}
                    >
                      {found.name}
                    </Typography>
                    <Typography sx={{ color: '#8A96A3', fontSize: 12, mt: 0.2 }}>
                      ИНН {found.inn}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ borderTop: '1px solid rgba(11,31,53,0.08)' }}>
                  {detailRows.map((row) => (
                    <Stack
                      key={row.k}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                      sx={{
                        py: 1,
                        borderBottom: '1px solid rgba(11,31,53,0.06)',
                        gap: 1.5,
                      }}
                    >
                      <Typography sx={{ color: '#8A96A3', fontSize: 13, flexShrink: 0 }}>
                        {row.k}
                      </Typography>
                      <Typography
                        sx={{
                          color: '#0B1F35',
                          fontSize: 13,
                          fontWeight: 700,
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
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={creating}
                  onClick={onConfirm}
                  sx={{ mt: 2, borderRadius: 2.5, fontWeight: 700, py: 1.2, fontSize: 14 }}
                >
                  {creating ? <CircularProgress size={18} color="inherit" /> : 'Подтвердить доступ'}
                </Button>
                <Typography
                  sx={{
                    mt: 1.25,
                    color: '#B0B8C1',
                    fontSize: 11,
                    textAlign: 'center',
                    lineHeight: 1.35,
                  }}
                >
                  После подтверждения компания появится в списке выбора
                </Typography>
              </Box>
            ) : (
              <Typography
                sx={{
                  color: '#B0B8C1',
                  fontSize: 14,
                  lineHeight: 1.45,
                  textAlign: 'center',
                  maxWidth: 240,
                }}
              >
                После поиска справа появится карточка компании из реестра
              </Typography>
            )}
          </Box>
        </Box>

        <Button
          onClick={onLogout}
          sx={{
            alignSelf: { xs: 'center', md: 'flex-start' },
            color: '#8A96A3',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Выйти из аккаунта
        </Button>
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
  onClose,
  onLogout,
}: {
  selected: CompanyListItem
  dash: Awaited<ReturnType<typeof getCompanyDashboard>> | undefined
  dashLoading: boolean
  onContinue: () => void
  onClose: () => void
  onLogout: () => void
}) {
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
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 2, flexShrink: 0 }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 18, md: 20 },
            letterSpacing: '-0.02em',
            color: '#0B1F35',
            lineHeight: 1.2,
          }}
        >
          Подробнее о компании
        </Typography>
        <Button
          onClick={onClose}
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.5,
            color: '#8A96A3',
            fontWeight: 600,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          Закрыть
        </Button>
      </Stack>

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
