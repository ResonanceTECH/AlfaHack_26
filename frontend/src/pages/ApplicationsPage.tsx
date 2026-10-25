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
import { Link as RouterLink, useNavigate } from 'react-router-dom'

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
    nextStep: 'Платёж 28.10 · 114 000 ₽',
    nextStepAction: 'text',
    href: '/app/applications/ABC-2026-0987',
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
  const [tab, setTab] = useState<TabKey>('all')
  const [draftsOnly, setDraftsOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState('all')
  const [period, setPeriod] = useState('12')
  const [flash, setFlash] = useState<string | null>(null)

  const companies = useMemo(
    () => Array.from(new Set(DEMO.map((d) => d.company))),
    [],
  )

  const draftCount = DEMO.filter((d) => d.tab === 'draft').length
  const reviewCount = DEMO.filter((d) => d.tab === 'work').length
  const contractCount = DEMO.filter((d) => d.tab === 'contracts').length
  const rejectedCount = DEMO.filter((d) => d.tab === 'rejected').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return DEMO.filter((d) => {
      if (draftsOnly && d.tab !== 'draft') return false
      if (!draftsOnly) {
        if (tab === 'work' && d.tab !== 'work') return false
        if (tab === 'contracts' && d.tab !== 'contracts') return false
        if (tab === 'rejected' && d.tab !== 'rejected') return false
        if (tab === 'archive' && d.tab !== 'archive') return false
        if (tab === 'all' && d.tab === 'archive') return false
      }
      if (company !== 'all' && d.company !== company) return false
      if (!q) return true
      return (
        d.id.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.amount.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q)
      )
    })
  }, [tab, search, company, draftsOnly])

  const visibleTotal = DEMO.filter((d) => d.tab !== 'archive').length

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `Все (${visibleTotal})` },
    { key: 'work', label: 'В работе' },
    { key: 'contracts', label: 'Договоры' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'archive', label: 'Архив' },
  ]

  const statCards = [
    {
      label: 'На рассмотрении',
      value: reviewCount,
      caption: 'ABC-2026-1042 · ждёт ответа',
      captionColor: '#C45A12',
    },
    {
      label: 'Активные договоры',
      value: contractCount,
      caption: 'ABC-2026-0987',
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
      caption: 'ABC-2025-0644',
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
            component={RouterLink}
            to="/app/readiness"
            size="small"
            sx={{
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 12.5,
              px: 1.35,
              py: 0.55,
              minHeight: 0,
              color: '#1B8A5A',
              bgcolor: '#E6F5EE',
              border: '1px solid rgba(27,138,90,0.25)',
              '&:hover': { bgcolor: '#D8F0E4', borderColor: 'rgba(27,138,90,0.4)' },
            }}
          >
            Готовность 78 · анализ
          </Button>
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
          value={company}
          onChange={(e) => setCompany(e.target.value)}
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
