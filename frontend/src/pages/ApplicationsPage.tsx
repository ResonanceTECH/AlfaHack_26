import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { loadLocalApps, mergeApplications } from '@/features/applications/localApps'
import { useAppStore } from '@/hooks/useAppStore'
import { statusLabels } from '@/data/labels'
import { formatDate, formatMoney } from '@/utils/format'
import type { ApplicationStatus, CreditApplication } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '& fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
  },
} as const

type AppStatus =
  | 'alternative'
  | 'signed'
  | 'draft'
  | 'rejected'
  | 'review'
  | 'archive'

type AppRow = {
  id: string
  title: string
  company: string
  amount: string
  term: string
  status: AppStatus
  statusLabel: string
  submitted: string
  nextStep: string
  nextStepAction?: 'link' | 'text'
  href?: string
  editable?: boolean
  tab: 'work' | 'contracts' | 'rejected' | 'archive' | 'draft'
}

const DEMO: AppRow[] = [
  {
    id: 'ABC-2026-1042',
    title: 'Пополнение оборотных средств',
    company: 'ООО «Кофе Плюс»',
    amount: '5 000 000 ₽',
    term: '24 мес.',
    status: 'alternative',
    statusLabel: 'Есть альтернатива',
    submitted: '21.10.2026',
    nextStep: 'Принять или изменить условия',
    nextStepAction: 'link',
    href: '/app/applications/ABC-2026-1042/edit',
    editable: true,
    tab: 'work',
  },
  {
    id: 'ABC-2026-0987',
    title: 'Покупка кофемашины La Marzocco',
    company: 'ООО «Кофе Плюс»',
    amount: '1 800 000 ₽',
    term: '18 мес.',
    status: 'signed',
    statusLabel: 'Договор подписан',
    submitted: '02.09.2026',
    nextStep: 'Открыть договор',
    nextStepAction: 'link',
    href: '/app/applications/ABC-2026-0987/contract',
    editable: false,
    tab: 'contracts',
  },
  {
    id: 'ABC-2026-1051',
    title: 'Ремонт и обновление точки',
    company: 'ООО «Кофе Плюс»',
    amount: '900 000 ₽',
    term: '12 мес.',
    status: 'draft',
    statusLabel: 'Черновик · шаг 3/6',
    submitted: '—',
    nextStep: 'Продолжить заполнение',
    nextStepAction: 'link',
    href: '/app/applications/new',
    editable: true,
    tab: 'draft',
  },
  {
    id: 'ABC-2026-1060',
    title: 'Закупка инвентаря',
    company: 'ИП Петров А.В.',
    amount: '600 000 ₽',
    term: '12 мес.',
    status: 'draft',
    statusLabel: 'Черновик · шаг 1/6',
    submitted: '—',
    nextStep: 'Продолжить заполнение',
    nextStepAction: 'link',
    href: '/app/applications/new',
    editable: true,
    tab: 'draft',
  },
  {
    id: 'ABC-2025-0644',
    title: 'Овердрафт на кассовые разрывы',
    company: 'ООО «Кофе Плюс»',
    amount: '1 000 000 ₽',
    term: '12 мес.',
    status: 'rejected',
    statusLabel: 'Отклонена',
    submitted: '14.11.2025',
    nextStep: 'Повторная подача через 30 дней',
    nextStepAction: 'text',
    href: '/app/applications/ABC-2025-0644',
    editable: false,
    tab: 'rejected',
  },
]

function appCode(id: string): string {
  return id.toUpperCase().startsWith('ABC') ? id : `ABC-${id.slice(-8).toUpperCase()}`
}

function mapApiStatus(status: ApplicationStatus): {
  status: AppStatus
  tab: AppRow['tab']
  nextStep: string
  nextStepAction: 'link' | 'text'
  editable: boolean
} {
  switch (status) {
    case 'draft':
      return {
        status: 'draft',
        tab: 'draft',
        nextStep: 'Продолжить заполнение',
        nextStepAction: 'link',
        editable: true,
      }
    case 'approved':
      return {
        status: 'alternative',
        tab: 'work',
        nextStep: 'Принять предложение банка',
        nextStepAction: 'link',
        editable: false,
      }
    case 'counteroffered':
      return {
        status: 'alternative',
        tab: 'work',
        nextStep: 'Рассмотреть контрпредложение',
        nextStepAction: 'link',
        editable: false,
      }
    case 'offer_accepted':
    case 'agreement_preparation':
      return {
        status: 'signed',
        tab: 'contracts',
        nextStep: 'Ознакомьтесь с договором',
        nextStepAction: 'link',
        editable: false,
      }
    case 'issued':
      return {
        status: 'signed',
        tab: 'contracts',
        nextStep: 'Открыть договор',
        nextStepAction: 'link',
        editable: false,
      }
    case 'rejected':
      return {
        status: 'rejected',
        tab: 'rejected',
        nextStep: 'Повторная подача через 30 дней',
        nextStepAction: 'text',
        editable: false,
      }
    default:
      return {
        status: 'review',
        tab: 'work',
        nextStep: 'Открыть трекер',
        nextStepAction: 'link',
        editable: false,
      }
  }
}

function toRow(a: CreditApplication, companyName: string): AppRow {
  const meta = mapApiStatus(a.status)
  const code = appCode(a.id)
  const canEditOffer = a.status === 'approved' && code === 'ABC-2026-1042'
  const href =
    a.status === 'draft'
      ? '/app/applications/new'
      : a.status === 'issued'
        ? `/app/applications/${a.id}/contract`
        : canEditOffer
          ? `/app/applications/${a.id}/edit`
          : `/app/applications/${a.id}`
  return {
    id: code,
    title: a.purpose || a.productName,
    company: companyName,
    amount: formatMoney(a.amount),
    term: `${a.termMonths} мес.`,
    status: meta.status,
    statusLabel: statusLabels[a.status],
    submitted: a.status === 'draft' ? '—' : formatDate(a.createdAt),
    nextStep: canEditOffer
      ? 'Принять или изменить условия'
      : a.status === 'approved' || a.status === 'counteroffered'
        ? meta.nextStep
        : meta.nextStep,
    nextStepAction: meta.nextStepAction,
    href,
    editable: a.status === 'draft' || canEditOffer,
    tab: meta.tab,
  }
}

const STATUS_STYLE: Record<AppStatus, { bg: string; color: string }> = {
  alternative: { bg: '#FFF0E0', color: '#C45A12' },
  signed: { bg: '#E6F5EE', color: '#1B8A5A' },
  draft: { bg: '#EEF1F4', color: '#5A6B7D' },
  rejected: { bg: '#FDE8E6', color: '#C41E14' },
  review: { bg: '#FFF0E0', color: '#C45A12' },
  archive: { bg: '#EEF1F4', color: '#7A8795' },
}

type TabKey = 'all' | 'work' | 'contracts' | 'rejected' | 'archive'

function StatusChip({ status, label }: { status: AppStatus; label: string }) {
  const s = STATUS_STYLE[status]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        px: 1,
        py: 0.35,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

export function ApplicationsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { apps, company, companyId } = useAppStore()
  const [tab, setTab] = useState<TabKey>('all')
  const [draftsOnly, setDraftsOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [period, setPeriod] = useState('12')
  const [flash, setFlash] = useState<string | null>(null)

  const rows = useMemo(() => {
    const companyName = company?.name ?? 'Моя компания'
    const live = mergeApplications(apps, loadLocalApps(companyId)).map((a) =>
      toRow(a, companyName),
    )
    const liveIds = new Set(live.map((r) => r.id))
    const demoExtra = DEMO.filter((d) => !liveIds.has(d.id))
    return [...live, ...demoExtra]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, companyId, company?.name, location.key])

  const companies = useMemo(
    () => Array.from(new Set(rows.map((d) => d.company))),
    [rows],
  )

  const draftCount = rows.filter((d) => d.tab === 'draft').length
  const reviewCount = rows.filter((d) => d.tab === 'work').length
  const contractCount = rows.filter((d) => d.tab === 'contracts').length
  const rejectedCount = rows.filter((d) => d.tab === 'rejected').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((d) => {
      if (draftsOnly && d.tab !== 'draft') return false
      if (!draftsOnly) {
        if (tab === 'work' && d.tab !== 'work') return false
        if (tab === 'contracts' && d.tab !== 'contracts') return false
        if (tab === 'rejected' && d.tab !== 'rejected') return false
        if (tab === 'archive' && d.tab !== 'archive') return false
        if (tab === 'all' && d.tab === 'archive') return false
      }
      if (companyFilter !== 'all' && d.company !== companyFilter) return false
      if (!q) return true
      return (
        d.id.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.amount.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q)
      )
    })
  }, [tab, search, companyFilter, draftsOnly, rows])

  const visibleTotal = rows.filter((d) => d.tab !== 'archive').length

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `Все (${visibleTotal})` },
    { key: 'work', label: 'В работе' },
    { key: 'contracts', label: 'Договоры' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'archive', label: 'Архив' },
  ]

  const workSample = rows.find((d) => d.tab === 'work')
  const contractSample = rows.find((d) => d.tab === 'contracts')
  const rejectedSample = rows.find((d) => d.tab === 'rejected')

  const statCards = [
    {
      label: 'На рассмотрении',
      value: reviewCount,
      caption: workSample ? `${workSample.id} · ждёт ответа` : 'нет активных',
      captionColor: '#C45A12',
    },
    {
      label: 'Активные договоры',
      value: contractCount,
      caption: contractSample?.id ?? '—',
      captionColor: '#1B8A5A',
    },
    {
      label: 'Черновики',
      value: draftCount,
      caption: 'автосохранение',
      captionColor: '#9AA5B1',
    },
    {
      label: 'Отклонённые',
      value: rejectedCount,
      caption: rejectedSample?.id ?? '—',
      captionColor: '#C41E14',
    },
  ]

  const thSx = {
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 700,
    color: '#9AA5B1',
    pb: 1.25,
    pr: 1.5,
    borderBottom: '1px solid rgba(11,31,53,0.08)',
  }

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2000)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
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
            Мои заявки
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            {visibleTotal} заявки · {companies.length} компании
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center">
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              setDraftsOnly(true)
              setTab('all')
            }}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Черновики ({draftCount})
          </Button>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/app/applications/new"
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Новая заявка
          </Button>
        </Stack>
      </Stack>

      {flash && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {flash}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 2.5,
        }}
      >
        {statCards.map((c) => (
          <Box key={c.label} sx={tileSx}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#9AA5B1', mb: 0.75 }}>
              {c.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: '-0.03em',
                color: '#0B1F35',
                lineHeight: 1,
                mb: 0.75,
              }}
            >
              {c.value}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: c.captionColor }}>
              {c.caption}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack
        direction="row"
        sx={{
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          mb: 2,
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              onClick={() => {
                setDraftsOnly(false)
                setTab(t.key)
              }}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                px: 1.75,
                py: 1.15,
                fontSize: 14,
                fontWeight: 700,
                color: active && !draftsOnly ? '#0B1F35' : '#7A8795',
                borderBottom:
                  active && !draftsOnly ? '2px solid #EF3124' : '2px solid transparent',
                whiteSpace: 'nowrap',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
            </Box>
          )
        })}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1.4fr) minmax(140px, 0.7fr) minmax(110px, 0.5fr) auto',
          },
          mb: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Номер, цель или сумма"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={fieldSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 20, color: '#9AA5B1' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Компания"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          sx={fieldSx}
        >
          <MenuItem value="all">Все</MenuItem>
          {companies.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Период"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={fieldSx}
        >
          <MenuItem value="3">3 мес</MenuItem>
          <MenuItem value="6">6 мес</MenuItem>
          <MenuItem value="12">12 мес</MenuItem>
          <MenuItem value="24">24 мес</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={() => flashMsg('Экспорт подготовлен')}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            height: 40,
            justifySelf: { xs: 'stretch', md: 'end' },
          }}
        >
          Экспорт
        </Button>
      </Box>

      <Box sx={{ ...tileSx, mb: 1.5, overflow: 'auto', p: { xs: 1.5, md: 2 } }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <Box component="thead">
            <Box component="tr">
              {[
                'Заявка',
                'Компания',
                'Запрошено',
                'Срок',
                'Статус',
                'Подана',
                'Следующий шаг',
              ].map((h) => (
                <Box component="th" key={h} sx={thSx}>
                  {h}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {filtered.map((row) => (
              <Box
                component="tr"
                key={row.id}
                onClick={() => row.href && navigate(row.href)}
                sx={{
                  cursor: row.href ? 'pointer' : 'default',
                  '&:hover': { bgcolor: 'rgba(11,31,53,0.02)' },
                  '& td': {
                    py: 1.5,
                    pr: 1.5,
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    verticalAlign: 'middle',
                  },
                }}
              >
                <Box component="td" sx={{ minWidth: 200 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', lineHeight: 1.3 }}>
                      {row.title}
                    </Typography>
                    {row.editable && (
                      <Box
                        component="span"
                        sx={{
                          px: 0.75,
                          py: 0.2,
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: 'rgba(239,49,36,0.08)',
                          color: '#EF3124',
                        }}
                      >
                        можно изменить
                      </Box>
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.25 }}>{row.id}</Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D', whiteSpace: 'nowrap' }}>
                    {row.company}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', whiteSpace: 'nowrap' }}>
                    {row.amount}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D', whiteSpace: 'nowrap' }}>
                    {row.term}
                  </Typography>
                </Box>
                <Box component="td">
                  <StatusChip status={row.status} label={row.statusLabel} />
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: row.submitted === '—' ? '#C5CCD3' : '#5A6B7D' }}>
                    {row.submitted}
                  </Typography>
                </Box>
                <Box component="td" sx={{ pr: '0 !important', maxWidth: 220 }}>
                  {row.nextStepAction === 'link' ? (
                    <Typography
                      component="span"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (row.href) navigate(row.href)
                      }}
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#EF3124',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {row.nextStep}
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: '#5A6B7D', lineHeight: 1.35 }}>
                      {row.nextStep}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={7} sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                    {tab === 'archive' ? 'Архив пуст' : 'Заявки не найдены'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 12.5, color: '#9AA5B1' }}>
        Показано {filtered.length} из {tab === 'archive' ? filtered.length : visibleTotal}
        {tab !== 'archive' ? ' · ранее скрытые заявки в архиве' : ''}
      </Typography>
    </Box>
  )
}
