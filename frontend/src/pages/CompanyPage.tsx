import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCompanies,
  updateCompany,
  verifyCompanyRegistry,
} from '@/api/companies'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import { industries, regions } from '@/data/labels'
import { formatDate, formatMoney } from '@/utils/format'
import type { Company } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const outlineBtn = {
  borderRadius: 2,
  borderColor: 'rgba(11,31,53,0.14)',
  color: '#0B1F35',
  fontWeight: 600,
  textTransform: 'none' as const,
  bgcolor: '#fff',
  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
}

type TabKey = 'requisites' | 'owners' | 'addresses' | 'accounts' | 'contacts'

const OWNERS = [
  {
    name: 'Миронов Сергей Павлович',
    role: 'Генеральный директор',
    share: '60%',
    ok: true,
    badge: 'Подтверждён',
  },
  {
    name: 'Лебедева Ирина Олеговна',
    role: 'Участник / бенефициар',
    share: '30%',
    ok: true,
    badge: 'Подтверждён',
  },
  {
    name: 'Громов Артём Викторович',
    role: 'Участник',
    share: '10%',
    ok: false,
    badge: 'Нужен паспорт',
  },
]

function yearsInBusiness(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  const now = new Date()
  let y = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y -= 1
  return Math.max(0, y)
}

function fullLegalName(c: Company): string {
  if (c.legalForm === 'IP') {
    const bare = c.name.replace(/^ИП\s+/i, '')
    return `Индивидуальный предприниматель ${bare}`
  }
  if (/^ООО/i.test(c.name) || /общество/i.test(c.name)) return c.name
  return `Общество с ограниченной ответственностью «${c.name.replace(/^ООО\s*[«"]?|[»"]$/gi, '')}»`
}

function shortName(c: Company): string {
  if (c.legalForm === 'IP') return c.name.startsWith('ИП') ? c.name : `ИП ${c.name}`
  if (/^ООО/i.test(c.name)) return c.name
  return `ООО «${c.name.replace(/[«»"]/g, '')}»`
}

function kppFromInn(inn: string): string {
  if (inn.length === 10) return `${inn.slice(0, 4)}01001`
  return '—'
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 0.35 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 650, color: '#0B1F35', lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  )
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean
  label: string
}) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        px: 1,
        py: 0.3,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: ok ? '#E6F5EE' : '#FFF0E0',
        color: ok ? '#1B8A5A' : '#C45A12',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

function CompletenessRing({ value }: { value: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  return (
    <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#E8EBEE" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="#EF3124"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0B1F35', lineHeight: 1.1 }}>
          {value}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: '#9AA5B1', fontWeight: 600 }}>заполнено</Typography>
      </Box>
    </Box>
  )
}

export function CompanyPage() {
  const { user, selectCompany } = useAuth()
  const { company, companyId, isLoading, isError, error: storeError, refetchAll } = useAppStore()
  const qc = useQueryClient()

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user),
  })

  const [tab, setTab] = useState<TabKey>('requisites')
  const [editOpen, setEditOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editEmployees, setEditEmployees] = useState(1)
  const [editOgrn, setEditOgrn] = useState('')
  const [editRegDate, setEditRegDate] = useState('')

  const completeness = useMemo(() => {
    if (!company) return 0
    let filled = 0
    const checks = [
      Boolean(company.name),
      Boolean(company.inn),
      Boolean(company.ogrn),
      Boolean(company.industry),
      Boolean(company.region),
      Boolean(company.registrationDate),
      company.employeesCount > 0,
      company.registryStatus === 'ACTIVE',
    ]
    filled = checks.filter(Boolean).length
    // mock: 5/6 sections ≈ 86%
    return Math.round((filled / checks.length) * 100)
  }, [company])

  function openEdit() {
    if (!company) return
    setEditName(company.name)
    setEditIndustry(company.industry)
    setEditRegion(company.region)
    setEditEmployees(company.employeesCount)
    setEditOgrn(company.ogrn)
    setEditRegDate(company.registrationDate)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!companyId) return
    setError(null)
    try {
      await updateCompany(companyId, {
        name: editName.trim(),
        industry: editIndustry,
        region: editRegion,
        employeesCount: editEmployees,
        ogrn: editOgrn,
        registrationDate: editRegDate,
      })
      await qc.invalidateQueries({ queryKey: ['company', companyId] })
      await qc.invalidateQueries({ queryKey: ['companies'] })
      setEditOpen(false)
      setFlash('Профиль компании сохранён')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  async function onVerify() {
    if (!companyId) return
    setVerifying(true)
    setError(null)
    try {
      const res = await verifyCompanyRegistry(companyId)
      await qc.invalidateQueries({ queryKey: ['company', companyId] })
      setFlash(
        res.found
          ? `ИНН проверен · статус ${res.registryStatus ?? 'ACTIVE'}`
          : 'Компания не найдена в реестре',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка проверки ИНН')
    } finally {
      setVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress sx={{ color: '#EF3124' }} />
      </Box>
    )
  }

  if (!companyId) {
    return (
      <Box>
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 28, mb: 2 }}>
          Профиль компании
        </Typography>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/select-company">
              Выбрать компанию
            </Button>
          }
        >
          Компания не выбрана — добавьте или выберите организацию.
        </Alert>
      </Box>
    )
  }

  if (!company) {
    return (
      <Box>
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 28, mb: 2 }}>
          Профиль компании
        </Typography>
        <Alert
          severity={isError ? 'error' : 'warning'}
          action={
            <Button color="inherit" size="small" onClick={() => refetchAll()}>
              Повторить
            </Button>
          }
        >
          {storeError?.message || 'Не удалось загрузить компанию.'}
        </Alert>
      </Box>
    )
  }

  const years = yearsInBusiness(company.registrationDate)
  const list = companiesQ.data ?? []
  const updatedLabel = formatDate(new Date().toISOString())

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        Компания{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Профиль ИП/ООО
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Профиль компании
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            {shortName(company)} · обновлено {updatedLabel}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button variant="outlined" onClick={openEdit} sx={outlineBtn}>
            Редактировать
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={verifying}
            onClick={() => void onVerify()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              px: 2,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            {verifying ? 'Проверяем…' : 'Проверить ИНН'}
          </Button>
        </Stack>
      </Stack>

      {flash && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setFlash(null)}>
          {flash}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2.25,
          minHeight: 40,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 650,
            fontSize: 14,
            color: '#7A8795',
            minHeight: 40,
            px: 1.5,
          },
          '& .Mui-selected': { color: '#0B1F35 !important' },
          '& .MuiTabs-indicator': { bgcolor: '#EF3124', height: 2.5, borderRadius: 2 },
        }}
      >
        <Tab value="requisites" label="Реквизиты" />
        <Tab value="owners" label="Руководство и владельцы" />
        <Tab value="addresses" label="Адреса" />
        <Tab value="accounts" label="Банковские счета · 1" />
        <Tab value="contacts" label="Контакты" />
      </Tabs>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          {(tab === 'requisites' || tab === 'owners' || tab === 'contacts') && (
            <>
              {(tab === 'requisites' || tab === 'owners') && (
                <Box sx={tileSx}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography
                      sx={{
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 800,
                        fontSize: 16,
                        color: '#0B1F35',
                      }}
                    >
                      Реквизиты
                    </Typography>
                    <StatusPill
                      ok={company.registryStatus !== 'LIQUIDATED'}
                      label={
                        company.registryStatus === 'ACTIVE' || !company.registryStatus
                          ? 'Проверено в демо-реестре'
                          : String(company.registryStatus)
                      }
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    }}
                  >
                    <Field label="Полное наименование" value={fullLegalName(company)} />
                    <Field label="Краткое наименование" value={shortName(company)} />
                    <Field
                      label="ИНН / КПП"
                      value={`${company.inn} / ${kppFromInn(company.inn)}`}
                    />
                    <Field label="ОГРН" value={company.ogrn || '—'} />
                    <Field
                      label="Дата регистрации"
                      value={`${formatDate(company.registrationDate)}${
                        years ? ` · ${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'} в бизнесе` : ''
                      }`}
                    />
                    <Field
                      label="Система налогообложения"
                      value={company.legalForm === 'IP' ? 'УСН «доходы»' : 'УСН «доходы минус расходы»'}
                    />
                    <Field
                      label="Основной ОКВЭД"
                      value={
                        company.industry?.toLowerCase().includes('торгов')
                          ? '47.11 — Розничная торговля'
                          : company.industry || '—'
                      }
                    />
                    <Field
                      label="Численность"
                      value={`${company.employeesCount} ${
                        company.employeesCount % 10 === 1 && company.employeesCount % 100 !== 11
                          ? 'сотрудник'
                          : company.employeesCount % 10 >= 2 &&
                              company.employeesCount % 10 <= 4 &&
                              (company.employeesCount % 100 < 10 || company.employeesCount % 100 >= 20)
                            ? 'сотрудника'
                            : 'сотрудников'
                      }`}
                    />
                    <Field
                      label="Уставный капитал"
                      value={company.legalForm === 'OOO' ? formatMoney(10_000) : '—'}
                    />
                    <Field
                      label="Юридический адрес"
                      value={`${company.region || 'Москва'}, юр. адрес по ЕГРЮЛ`}
                    />
                  </Box>
                </Box>
              )}

              {(tab === 'owners' || tab === 'requisites') && (
                <Box sx={tileSx}>
                  <Typography
                    sx={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 800,
                      fontSize: 16,
                      color: '#0B1F35',
                      mb: 1.5,
                    }}
                  >
                    Руководство и владельцы
                  </Typography>
                  <Box sx={{ overflow: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                      <Box component="thead">
                        <Box component="tr">
                          {['ФИО', 'Роль', 'Доля', 'Проверка'].map((h) => (
                            <Box
                              component="th"
                              key={h}
                              sx={{
                                textAlign: 'left',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#9AA5B1',
                                pb: 1.1,
                                pr: 1.5,
                                borderBottom: '1px solid rgba(11,31,53,0.08)',
                              }}
                            >
                              {h}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {(company.legalForm === 'IP'
                          ? [
                              {
                                name: company.name.replace(/^ИП\s+/i, '') || user?.fullName || 'Владелец',
                                role: 'Индивидуальный предприниматель',
                                share: '100%',
                                ok: true,
                                badge: 'Подтверждён',
                              },
                            ]
                          : OWNERS
                        ).map((row) => (
                          <Box
                            component="tr"
                            key={row.name}
                            sx={{
                              '& td': {
                                py: 1.35,
                                pr: 1.5,
                                borderBottom: '1px solid rgba(11,31,53,0.06)',
                                verticalAlign: 'middle',
                              },
                            }}
                          >
                            <Box component="td">
                              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                                {row.name}
                              </Typography>
                            </Box>
                            <Box component="td">
                              <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{row.role}</Typography>
                            </Box>
                            <Box component="td">
                              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                                {row.share}
                              </Typography>
                            </Box>
                            <Box component="td">
                              <StatusPill ok={row.ok} label={row.badge} />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              {(tab === 'contacts' || tab === 'requisites') && (
                <Box sx={tileSx}>
                  <Typography
                    sx={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 800,
                      fontSize: 16,
                      color: '#0B1F35',
                      mb: 1.5,
                    }}
                  >
                    Контактные лица
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.75,
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    }}
                  >
                    <Field
                      label="Основной контакт"
                      value={`${user?.fullName || 'Миронов С.П.'} · ${user?.phone || '+7 (916) 482-14-20'}`}
                    />
                    <Field label="Бухгалтер" value="Лебедева И.О. · buh@kofeplus.demo" />
                    <Field
                      label="E-mail для уведомлений"
                      value={user?.email || 'sergey.mironov@kofeplus.demo'}
                    />
                    <Field label="Предпочтительный канал" value="Push + e-mail" />
                  </Box>
                </Box>
              )}
            </>
          )}

          {tab === 'addresses' && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.5,
                }}
              >
                Адреса
              </Typography>
              <Stack spacing={2}>
                <Field
                  label="Юридический адрес"
                  value={`${company.region || 'Москва'}, юр. адрес по ЕГРЮЛ / ЕГРИП`}
                />
                <Field
                  label="Фактический адрес"
                  value={`${company.region || 'Москва'}, совпадает с юридическим`}
                />
                <Field label="Почтовый адрес" value="Совпадает с юридическим" />
              </Stack>
            </Box>
          )}

          {tab === 'accounts' && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.5,
                }}
              >
                Банковские счета
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: '#F7F8FA',
                  border: '1px solid rgba(11,31,53,0.06)',
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: '#EF3124',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  А
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                    Альфа-Банк · расчётный
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 0.25 }}>
                    40702 ···· ···· 4821 · основной
                  </Typography>
                </Box>
                <StatusPill ok label="Активен" />
              </Stack>
              <Button
                fullWidth
                variant="outlined"
                sx={{ ...outlineBtn, mt: 1.75, py: 1 }}
                onClick={() => setFlash('Добавление счёта другого банка — в следующей версии')}
              >
                + Добавить счёт в другом банке
              </Button>
            </Box>
          )}
        </Stack>

        {/* Right sidebar */}
        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1.5,
              }}
            >
              Полнота профиля
            </Typography>
            <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 1.75 }}>
              <CompletenessRing value={Math.min(100, Math.max(completeness, 70))} />
              <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.45 }}>
                {completeness >= 85 ? '5 из 6 разделов.' : 'Профиль почти готов.'} Добавьте счёт в
                другом банке — это ускорит проверку заявки.
              </Typography>
            </Stack>
            <Button
              fullWidth
              variant="outlined"
              sx={{ ...outlineBtn, py: 1.05 }}
              onClick={() => setTab('accounts')}
            >
              Дополнить профиль
            </Button>
          </Box>

          <Box sx={tileSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  color: '#0B1F35',
                }}
              >
                Мои компании
              </Typography>
              <Button
                component={RouterLink}
                to="/select-company"
                size="small"
                sx={{
                  color: '#EF3124',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: 13,
                  minWidth: 0,
                  px: 0.5,
                }}
              >
                Управлять →
              </Button>
            </Stack>
            <Stack spacing={0}>
              {list.map((c) => {
                const current = c.id === companyId
                return (
                  <Stack
                    key={c.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      py: 1.15,
                      borderBottom: '1px solid rgba(11,31,53,0.06)',
                    }}
                  >
                    {current ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 22, color: '#1B8A5A' }} />
                    ) : (
                      <BusinessRoundedIcon sx={{ fontSize: 22, color: '#9AA5B1' }} />
                    )}
                    <Typography
                      sx={{
                        flex: 1,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0B1F35',
                        minWidth: 0,
                      }}
                      noWrap
                    >
                      {c.name}
                    </Typography>
                    {current ? (
                      <StatusPill ok label="Текущая" />
                    ) : (
                      <Button
                        size="small"
                        onClick={() => {
                          selectCompany(c.id)
                          void qc.invalidateQueries({ queryKey: ['company', c.id] })
                        }}
                        sx={{
                          color: '#EF3124',
                          fontWeight: 700,
                          textTransform: 'none',
                          fontSize: 12.5,
                          minWidth: 0,
                          px: 0.5,
                        }}
                      >
                        Выбрать
                      </Button>
                    )}
                  </Stack>
                )
              })}
            </Stack>
            <Button
              component={RouterLink}
              to="/select-company"
              fullWidth
              sx={{
                mt: 1.25,
                color: '#EF3124',
                fontWeight: 700,
                textTransform: 'none',
                justifyContent: 'flex-start',
                px: 0.25,
              }}
            >
              + Добавить компанию по ИНН
            </Button>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              Проверки и согласия
            </Typography>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', pr: 1 }}>
                  Согласие на обработку ПДн
                </Typography>
                <StatusPill ok label="Дано" />
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', pr: 1 }}>
                  Согласие на запрос БКИ
                </Typography>
                <StatusPill ok={false} label="Ожидает" />
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          Редактировать компанию
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Название"
              fullWidth
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <TextField label="ИНН" fullWidth value={company.inn} InputProps={{ readOnly: true }} />
            <TextField
              label="ОГРН / ОГРНИП"
              fullWidth
              value={editOgrn}
              onChange={(e) => setEditOgrn(e.target.value)}
            />
            <TextField
              select
              label="Отрасль"
              fullWidth
              value={editIndustry}
              onChange={(e) => setEditIndustry(e.target.value)}
            >
              {industries.map((i) => (
                <MenuItem key={i} value={i}>
                  {i}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Регион"
              fullWidth
              value={editRegion}
              onChange={(e) => setEditRegion(e.target.value)}
            >
              {regions.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Дата регистрации"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editRegDate}
                onChange={(e) => setEditRegDate(e.target.value)}
              />
              <TextField
                label="Сотрудники"
                type="number"
                fullWidth
                value={editEmployees}
                onChange={(e) => setEditEmployees(Number(e.target.value))}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ fontWeight: 600, color: '#5A6B7D' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void saveEdit()}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
