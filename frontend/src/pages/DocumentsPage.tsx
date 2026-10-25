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
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useMemo, useRef, useState } from 'react'

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

const APP_REF = 'ABC-2026-1042'

type DocStatus = 'accepted' | 'accepted_remark' | 'pending' | 'need_upload'
type DocCategory = 'Учредительные' | 'Финансовые' | 'Имущество' | 'Владельцы' | 'Согласия'

type DocItem = {
  id: string
  title: string
  category: DocCategory
  file: string | null
  uploadedAt: string | null
  status: DocStatus
}

type TabKey = 'all' | 'need_upload' | 'pending' | 'accepted'

const STATUS_META: Record<
  DocStatus,
  { label: string; bg: string; color: string }
> = {
  accepted: { label: 'Принят', bg: '#E6F5EE', color: '#1B8A5A' },
  accepted_remark: { label: 'Принят с замечанием', bg: '#FFF0E0', color: '#C45A12' },
  pending: { label: 'На проверке', bg: '#FFE8D6', color: '#C45A12' },
  need_upload: { label: 'Нужно загрузить', bg: '#FDE8E6', color: '#C41E14' },
}

const DEMO_DOCS: DocItem[] = [
  {
    id: 'd1',
    title: 'Устав ООО «Кофе Плюс»',
    category: 'Учредительные',
    file: 'ustav_kofeplus.pdf · 1,2 МБ',
    uploadedAt: '20.10.2026',
    status: 'accepted',
  },
  {
    id: 'd2',
    title: 'Бух. отчётность 2025',
    category: 'Финансовые',
    file: 'otchet_2025.xlsx · 860 КБ',
    uploadedAt: '18.10.2026',
    status: 'accepted_remark',
  },
  {
    id: 'd3',
    title: 'Выписка по расчётному счёту',
    category: 'Финансовые',
    file: 'extract_sep2026.pdf · 2,4 МБ',
    uploadedAt: '21.10.2026',
    status: 'pending',
  },
  {
    id: 'd4',
    title: 'Договор аренды помещения',
    category: 'Имущество',
    file: null,
    uploadedAt: null,
    status: 'need_upload',
  },
  {
    id: 'd5',
    title: 'Паспорт владельца',
    category: 'Владельцы',
    file: 'passport_scan.pdf · 540 КБ',
    uploadedAt: '15.10.2026',
    status: 'accepted',
  },
  {
    id: 'd6',
    title: 'Согласие на обработку ПДн',
    category: 'Согласия',
    file: 'consent_pd.pdf · 120 КБ',
    uploadedAt: '15.10.2026',
    status: 'accepted',
  },
  {
    id: 'd7',
    title: 'Справка об отсутствии задолженности',
    category: 'Финансовые',
    file: null,
    uploadedAt: null,
    status: 'need_upload',
  },
  {
    id: 'd8',
    title: 'Выписка из ЕГРЮЛ',
    category: 'Учредительные',
    file: 'egrul_kofeplus.pdf · 310 КБ',
    uploadedAt: '12.10.2026',
    status: 'accepted',
  },
]

function StatusChip({ status }: { status: DocStatus }) {
  const m = STATUS_META[status]
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
        bgcolor: m.bg,
        color: m.color,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </Box>
  )
}

function matchesTab(doc: DocItem, tab: TabKey) {
  if (tab === 'all') return true
  if (tab === 'need_upload') return doc.status === 'need_upload'
  if (tab === 'pending') return doc.status === 'pending'
  return doc.status === 'accepted' || doc.status === 'accepted_remark'
}

export function DocumentsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [docs, setDocs] = useState(DEMO_DOCS)
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | DocCategory>('all')
  const [period, setPeriod] = useState('12')
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const stats = useMemo(() => {
    const accepted = docs.filter(
      (d) => d.status === 'accepted' || d.status === 'accepted_remark',
    ).length
    const pending = docs.filter((d) => d.status === 'pending').length
    const need = docs.filter((d) => d.status === 'need_upload').length
    return { total: docs.length, accepted, pending, need }
  }, [docs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter((d) => {
      if (!matchesTab(d, tab)) return false
      if (category !== 'all' && d.category !== category) return false
      if (q && !d.title.toLowerCase().includes(q) && !(d.file ?? '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [docs, tab, search, category])

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function openUpload(docId?: string) {
    setUploadTarget(docId ?? null)
    fileRef.current?.click()
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    const sizeLabel =
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1).replace('.', ',')} МБ` : `${sizeKb} КБ`
    const fileLabel = `${file.name} · ${sizeLabel}`
    const today = new Date()
    const uploadedAt = `${String(today.getDate()).padStart(2, '0')}.${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}.${today.getFullYear()}`

    if (uploadTarget) {
      setDocs((list) =>
        list.map((d) =>
          d.id === uploadTarget
            ? { ...d, file: fileLabel, uploadedAt, status: 'pending' as const }
            : d,
        ),
      )
      flashMsg('Документ отправлен на проверку')
    } else {
      setDocs((list) => [
        {
          id: `d_${Date.now()}`,
          title: file.name.replace(/\.[^.]+$/, '') || 'Новый документ',
          category: 'Финансовые',
          file: fileLabel,
          uploadedAt,
          status: 'pending',
        },
        ...list,
      ])
      flashMsg('Документ загружен')
    }
    setUploadTarget(null)
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'all', label: 'Все' },
    { key: 'need_upload', label: 'Нужно загрузить', badge: stats.need },
    { key: 'pending', label: 'На проверке' },
    { key: 'accepted', label: 'Приняты' },
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

  const statCards = [
    {
      label: 'Всего документов',
      value: stats.total,
      caption: `по заявке ${APP_REF}`,
      captionColor: '#9AA5B1',
    },
    {
      label: 'Приняты',
      value: stats.accepted,
      caption: 'проверены менеджером',
      captionColor: '#1B8A5A',
    },
    {
      label: 'На проверке',
      value: stats.pending,
      caption: 'ожидает решения',
      captionColor: '#C45A12',
    },
    {
      label: 'Нужно загрузить',
      value: stats.need,
      caption: 'срок до 25.10.2026',
      captionColor: '#C41E14',
    },
  ]

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
        hidden
        onChange={onFilePicked}
      />

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
            Документы
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            По заявке {APP_REF} и профилю компании
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => flashMsg('ZIP формируется…')}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Скачать всё (ZIP)
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => openUpload()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Загрузить документ
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
        spacing={0}
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
              onClick={() => setTab(t.key)}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                px: 1.75,
                py: 1.15,
                fontSize: 14,
                fontWeight: 700,
                color: active ? '#0B1F35' : '#7A8795',
                borderBottom: active ? '2px solid #EF3124' : '2px solid transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                whiteSpace: 'nowrap',
                '&:hover': { color: '#0B1F35' },
              }}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <Box
                  component="span"
                  sx={{
                    minWidth: 20,
                    height: 20,
                    px: 0.6,
                    borderRadius: 999,
                    bgcolor: '#E8ECF0',
                    color: '#5A6B7D',
                    fontSize: 11.5,
                    fontWeight: 800,
                    display: 'inline-grid',
                    placeItems: 'center',
                  }}
                >
                  {t.badge}
                </Box>
              )}
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
            sm: 'minmax(0, 1.5fr) minmax(140px, 0.7fr) minmax(120px, 0.55fr)',
          },
          mb: 2,
        }}
      >
        <TextField
          placeholder="Поиск по названию"
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
          label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          sx={fieldSx}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="Учредительные">Учредительные</MenuItem>
          <MenuItem value="Финансовые">Финансовые</MenuItem>
          <MenuItem value="Имущество">Имущество</MenuItem>
          <MenuItem value="Владельцы">Владельцы</MenuItem>
          <MenuItem value="Согласия">Согласия</MenuItem>
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
      </Box>

      <Box sx={{ ...tileSx, mb: 2, overflow: 'auto', p: { xs: 1.5, md: 2 } }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <Box component="thead">
            <Box component="tr">
              {['Документ', 'Категория', 'Файл', 'Загружен', 'Статус', ''].map((h, i) => (
                <Box
                  component="th"
                  key={h || 'action'}
                  sx={{
                    ...thSx,
                    pr: i === 5 ? 0 : 1.5,
                    width: i === 5 ? 90 : undefined,
                  }}
                >
                  {h}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {filtered.map((d) => (
              <Box
                component="tr"
                key={d.id}
                sx={{
                  '& td': {
                    py: 1.5,
                    pr: 1.5,
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    verticalAlign: 'middle',
                  },
                }}
              >
                <Box component="td">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                    {d.title}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{d.category}</Typography>
                </Box>
                <Box component="td">
                  <Typography
                    sx={{
                      fontSize: d.file ? 12.5 : 13,
                      color: d.file ? '#5A6B7D' : '#C5CCD3',
                      fontFamily: d.file
                        ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                        : 'inherit',
                    }}
                  >
                    {d.file ?? '—'}
                  </Typography>
                </Box>
                <Box component="td">
                  <Typography sx={{ fontSize: 13, color: d.uploadedAt ? '#5A6B7D' : '#C5CCD3' }}>
                    {d.uploadedAt ?? '—'}
                  </Typography>
                </Box>
                <Box component="td">
                  <StatusChip status={d.status} />
                </Box>
                <Box component="td" sx={{ pr: '0 !important', textAlign: 'right' }}>
                  {d.status === 'need_upload' ? (
                    <Button
                      type="button"
                      size="small"
                      onClick={() => openUpload(d.id)}
                      sx={{
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#EF3124',
                        minWidth: 0,
                        px: 0.5,
                      }}
                    >
                      Загрузить
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="small"
                      onClick={() => flashMsg(`Открыт: ${d.title}`)}
                      sx={{
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#EF3124',
                        minWidth: 0,
                        px: 0.5,
                      }}
                    >
                      Открыть
                    </Button>
                  )}
                </Box>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                    Документы не найдены
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          alignItems: 'flex-start',
          px: 1.75,
          py: 1.4,
          borderRadius: 2.5,
          bgcolor: '#FFF6EB',
          border: '1px solid rgba(196,90,18,0.18)',
        }}
      >
        <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: '#7A5A3A', lineHeight: 1.45 }}>
          Принимаем PDF, JPG, PNG, XLSX до 20 МБ. Документы шифруются и доступны только менеджеру и
          аналитику по вашей заявке.
        </Typography>
      </Box>
    </Box>
  )
}
