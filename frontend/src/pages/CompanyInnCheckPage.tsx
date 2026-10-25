import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { lookupCompanyByInn, verifyCompanyRegistry } from '@/api/companies'
import { useAppStore } from '@/hooks/useAppStore'
import { formatDate } from '@/utils/format'
import { innLegalFormHint, isValidInn, kppFromInn } from '@/utils/inn'
import type { LegalForm, RegistryLookupResult } from '@/types'

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

type RecentItem = {
  id: string
  title: string
  ok: boolean
  detail?: string
}

const DEMO_RECENT: RecentItem[] = [
  { id: 'r1', title: 'ООО «Кофе Плюс»', ok: true, detail: 'Найдено' },
  { id: 'r2', title: 'ИП Петров А.В.', ok: true, detail: 'Найдено' },
  { id: 'r3', title: 'ИНН 7700000000', ok: false, detail: 'контрольная сумма неверна' },
]

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
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
        bgcolor: ok ? '#E6F5EE' : '#FCE8E6',
        color: ok ? '#1B8A5A' : '#EF3124',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

function CheckRow({ text }: { text: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        py: 1.1,
        borderBottom: '1px solid rgba(11,31,53,0.06)',
        '&:last-child': { borderBottom: 0 },
      }}
    >
      <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A' }} />
      <Typography sx={{ flex: 1, fontSize: 13.5, color: '#0B1F35', fontWeight: 600 }}>
        {text}
      </Typography>
      <StatusPill ok label="Пройдено" />
    </Stack>
  )
}

export function CompanyInnCheckPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const { company, companyId } = useAppStore()

  const initialInn = (params.get('inn') || company?.inn || '').replace(/\D/g, '')

  const [inn, setInn] = useState(initialInn)
  const [legalType, setLegalType] = useState<LegalForm>(
    () => innLegalFormHint(initialInn) ?? company?.legalForm ?? 'OOO',
  )
  const [result, setResult] = useState<RegistryLookupResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [recent, setRecent] = useState<RecentItem[]>(DEMO_RECENT)
  const [confirming, setConfirming] = useState(false)

  const digits = inn.replace(/\D/g, '')
  const checksumOk = useMemo(() => isValidInn(digits), [digits])
  const lengthOk = digits.length === 10 || digits.length === 12

  const lookupMut = useMutation({
    mutationFn: (value: string) => lookupCompanyByInn(value),
    onSuccess: (res, value) => {
      setResult(res)
      setConfirmed(false)
      const title = res.company?.name || `ИНН ${value}`
      setRecent((list) => [
        {
          id: `r_${Date.now()}`,
          title,
          ok: Boolean(res.found && res.innValid),
          detail: !res.innValid
            ? 'контрольная сумма неверна'
            : res.found
              ? 'Найдено'
              : 'Не найдено',
        },
        ...list.filter((x) => x.title !== title).slice(0, 4),
      ])
      if (res.company?.legalForm) setLegalType(res.company.legalForm)
    },
  })

  function onInnChange(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, 12)
    setInn(next)
    setResult(null)
    setConfirmed(false)
    const hint = innLegalFormHint(next)
    if (hint) setLegalType(hint)
  }

  function onCheck() {
    if (!lengthOk) return
    if (!checksumOk) {
      setResult({
        found: false,
        source: 'client',
        company: null,
        checkedAt: new Date().toISOString(),
        innValid: false,
      })
      setRecent((list) => [
        {
          id: `r_${Date.now()}`,
          title: `ИНН ${digits}`,
          ok: false,
          detail: 'контрольная сумма неверна',
        },
        ...list.slice(0, 4),
      ])
      return
    }
    lookupMut.mutate(digits)
  }

  function resetInn() {
    setResult(null)
    setConfirmed(false)
    setInn('')
  }

  async function onConfirm() {
    if (!confirmed || !result?.found) return
    setConfirming(true)
    try {
      if (companyId) {
        await verifyCompanyRegistry(companyId)
        await qc.invalidateQueries({ queryKey: ['company', companyId] })
      }
      navigate('/app/company')
    } catch {
      navigate('/app/company')
    } finally {
      setConfirming(false)
    }
  }

  const found = Boolean(result?.found && result.company)
  const showResult = result != null
  const reg = result?.company

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        Компания{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Проверка ИНН
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
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
            Проверка компании по ИНН
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Найдём организацию в демо-реестре и подтянем реквизиты
          </Typography>
        </Box>
        <Button
          variant="outlined"
          component={RouterLink}
          to="/app/help"
          sx={{ ...outlineBtn, alignSelf: 'flex-start' }}
        >
          Справка
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Шаг 1. Введите ИНН
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ sm: 'flex-start' }}
            sx={{ mb: 1 }}
          >
            <TextField
              label="ИНН (10 цифр для ООО, 12 — для ИП)"
              value={inn}
              onChange={(e) => onInnChange(e.target.value)}
              fullWidth
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  ...(lengthOk && checksumOk
                    ? {
                        '& fieldset': { borderColor: '#1B8A5A', borderWidth: 1.5 },
                        '&:hover fieldset': { borderColor: '#1B8A5A' },
                        '&.Mui-focused fieldset': { borderColor: '#1B8A5A' },
                      }
                    : lengthOk && !checksumOk
                      ? {
                          '& fieldset': { borderColor: '#EF3124', borderWidth: 1.5 },
                        }
                      : {}),
                },
              }}
              InputProps={{
                endAdornment:
                  lengthOk && checksumOk ? (
                    <InputAdornment position="end">
                      <CheckCircleRoundedIcon sx={{ color: '#1B8A5A', fontSize: 22 }} />
                    </InputAdornment>
                  ) : lengthOk && !checksumOk ? (
                    <InputAdornment position="end">
                      <ErrorOutlineRoundedIcon sx={{ color: '#EF3124', fontSize: 22 }} />
                    </InputAdornment>
                  ) : undefined,
              }}
              helperText={
                !digits
                  ? ' '
                  : !lengthOk
                    ? 'Нужно 10 или 12 цифр'
                    : checksumOk
                      ? 'Контрольная сумма корректна'
                      : 'Контрольная сумма неверна'
              }
              FormHelperTextProps={{
                sx: {
                  color: !lengthOk
                    ? '#9AA5B1'
                    : checksumOk
                      ? '#1B8A5A !important'
                      : '#EF3124 !important',
                  fontWeight: 600,
                  mx: 0,
                },
              }}
            />
            <TextField
              select
              label="Тип"
              value={legalType}
              onChange={(e) => setLegalType(e.target.value as LegalForm)}
              sx={{
                width: { xs: '100%', sm: 120 },
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            >
              <MenuItem value="OOO">ООО</MenuItem>
              <MenuItem value="IP">ИП</MenuItem>
            </TextField>
            <Button
              variant="contained"
              color="primary"
              disabled={!lengthOk || lookupMut.isPending}
              onClick={onCheck}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                px: 2.5,
                py: 1.35,
                boxShadow: 'none',
                height: 56,
                flexShrink: 0,
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {lookupMut.isPending ? <CircularProgress size={22} color="inherit" /> : 'Проверить'}
            </Button>
          </Stack>

          {showResult && (
            <Box sx={{ mt: 2.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 16,
                    color: '#0B1F35',
                  }}
                >
                  Результат проверки
                </Typography>
                <StatusPill
                  ok={found}
                  label={
                    !result!.innValid
                      ? 'Ошибка контрольной суммы'
                      : found
                        ? 'Найдено в демо-реестре'
                        : 'Не найдено'
                  }
                />
              </Stack>

              {found && reg ? (
                <>
                  <Box
                    sx={{
                      bgcolor: '#F5F7F9',
                      borderRadius: 2.5,
                      p: 2,
                      border: '1px solid rgba(11,31,53,0.06)',
                      mb: 1.5,
                    }}
                  >
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0B1F35' }}>
                      {reg.name}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#7A8795', mt: 0.35, mb: 1.75 }}>
                      {reg.legalForm === 'IP'
                        ? `Индивидуальный предприниматель`
                        : `Общество с ограниченной ответственностью`}
                      {reg.name.replace(/^ООО\s*/i, '').includes('«')
                        ? ''
                        : reg.legalForm === 'OOO'
                          ? ` «${reg.name.replace(/^ООО\s*[«"]?|[»"]$/gi, '')}»`
                          : ''}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      }}
                    >
                      {[
                        ['КПП', kppFromInn(reg.inn)],
                        ['ОГРН', reg.ogrn || '—'],
                        ['Дата регистрации', formatDate(reg.registrationDate)],
                        [
                          'Статус',
                          reg.registryStatus === 'ACTIVE' || reg.registryStatus === 'Действующая'
                            ? 'Действующая'
                            : reg.registryStatus,
                        ],
                        ['Руководитель', 'Миронов Сергей Павлович'],
                        ['Адрес', `${reg.region}, юр. адрес по ЕГРЮЛ`],
                      ].map(([k, v]) => (
                        <Box key={k}>
                          <Typography sx={{ fontSize: 11.5, color: '#9AA5B1', mb: 0.25 }}>
                            {k}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color:
                                k === 'Статус' && String(v).includes('Действующ')
                                  ? '#1B8A5A'
                                  : '#0B1F35',
                            }}
                          >
                            {v}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <CheckRow text="Организация действующая, ликвидации нет" />
                    <CheckRow text="Нет признаков банкротства (демо-данные)" />
                  </Box>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={confirmed}
                        onChange={(_, v) => setConfirmed(v)}
                        sx={{
                          color: '#EF3124',
                          '&.Mui-checked': { color: '#EF3124' },
                        }}
                      />
                    }
                    label="Подтверждаю, что организация принадлежит мне и данные верны"
                    sx={{
                      mb: 1.75,
                      alignItems: 'flex-start',
                      '& .MuiFormControlLabel-label': {
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#0B1F35',
                        pt: 1,
                      },
                    }}
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={!confirmed || confirming}
                      onClick={() => void onConfirm()}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: 'none',
                        px: 2.5,
                        '&:hover': { boxShadow: 'none' },
                      }}
                    >
                      {confirming ? '…' : 'Подтвердить и продолжить'}
                    </Button>
                    <Button variant="outlined" onClick={resetInn} sx={outlineBtn}>
                      Изменить ИНН
                    </Button>
                  </Stack>
                </>
              ) : (
                <Box
                  sx={{
                    bgcolor: '#F5F7F9',
                    borderRadius: 2.5,
                    p: 2,
                    border: '1px solid rgba(11,31,53,0.06)',
                  }}
                >
                  <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.5 }}>
                    {!result?.innValid
                      ? 'ИНН не проходит проверку контрольной суммы. Проверьте цифры и попробуйте снова.'
                      : 'Организация не найдена в демо-реестре. Уточните ИНН или напишите менеджеру.'}
                  </Typography>
                  <Button variant="outlined" onClick={resetInn} sx={{ ...outlineBtn, mt: 1.5 }}>
                    Изменить ИНН
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Stack spacing={2}>
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
              Недавние проверки
            </Typography>
            <Stack spacing={0}>
              {recent.slice(0, 5).map((r, i, arr) => (
                <Stack
                  key={r.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{
                    py: 1.1,
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }} noWrap>
                      {r.title}
                    </Typography>
                    {!r.ok && r.detail && (
                      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.25 }}>
                        {r.detail}
                      </Typography>
                    )}
                  </Box>
                  <StatusPill ok={r.ok} label={r.ok ? 'Найдено' : 'Ошибка'} />
                </Stack>
              ))}
            </Stack>
          </Box>

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
              Как это работает
            </Typography>
            <Stack spacing={1.5}>
              {[
                {
                  n: 1,
                  t: 'Введите ИНН',
                  d: 'Проверяем формат и контрольную сумму',
                  accent: true,
                },
                {
                  n: 2,
                  t: 'Сверим с демо-реестром',
                  d: 'Подтянем реквизиты и руководителя',
                },
                {
                  n: 3,
                  t: 'Подтвердите принадлежность',
                  d: 'Откроется кредитный паспорт компании',
                },
              ].map((s) => (
                <Stack key={s.n} direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      bgcolor: s.accent ? '#EF3124' : '#0B1F35',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                      {s.t}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 0.2 }}>
                      {s.d}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1,
              }}
            >
              Если ИНН не найден
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.45, mb: 1.25 }}>
              Проверьте цифры или напишите менеджеру — поможем разобрать реестровую запись.
            </Typography>
            <Button
              component={RouterLink}
              to="/app/help"
              sx={{
                color: '#EF3124',
                fontWeight: 700,
                textTransform: 'none',
                px: 0,
                justifyContent: 'flex-start',
              }}
            >
              Написать Ивановой А.С. →
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
