import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material'
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { useCallback, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { importStatement } from '@/api/statements'
import { useAppStore } from '@/hooks/useAppStore'
import { formatFileSize } from '@/utils/format'

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

const MAX_BYTES = 20 * 1024 * 1024
const ACCEPT = '.xlsx,.xls,.csv,.txt,.pdf'

type FileStatus = 'done' | 'processing' | 'error'

type UploadItem = {
  id: string
  file: File
  name: string
  size: number
  status: FileStatus
  progress: number
  meta?: string
  error?: string
}

const DEMO_SEED: Omit<UploadItem, 'file'>[] = [
  {
    id: 'demo1',
    name: 'Выписка_р-с_4821_11.2025-09.2026.xlsx',
    size: 2.4 * 1024 * 1024,
    status: 'done',
    progress: 100,
    meta: '11 мес.',
  },
  {
    id: 'demo2',
    name: '1С_экспорт_октябрь_2026.txt',
    size: 184 * 1024,
    status: 'processing',
    progress: 64,
  },
  {
    id: 'demo3',
    name: 'scan_vypiska.pdf',
    size: 8.1 * 1024 * 1024,
    status: 'error',
    progress: 100,
    meta: 'не удалось распознать таблицу',
    error:
      'Файл похож на скан без текстового слоя. Скачайте выписку из интернет-банка в Excel или формате 1С (.txt).',
  },
]

function StatusPill({ status, progress }: { status: FileStatus; progress: number }) {
  if (status === 'done') {
    return (
      <Box
        sx={{
          px: 1,
          py: 0.35,
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          bgcolor: '#E6F5EE',
          color: '#1B8A5A',
          whiteSpace: 'nowrap',
        }}
      >
        Загружено
      </Box>
    )
  }
  if (status === 'processing') {
    return (
      <Box
        sx={{
          px: 1,
          py: 0.35,
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          bgcolor: '#FFF0E0',
          color: '#C45A12',
          whiteSpace: 'nowrap',
        }}
      >
        Обработка {progress}%
      </Box>
    )
  }
  return (
    <Box
      sx={{
        px: 1,
        py: 0.35,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: '#FCE8E6',
        color: '#EF3124',
        whiteSpace: 'nowrap',
      }}
    >
      Ошибка
    </Box>
  )
}

function filesLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} файл`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} файла`
  return `${n} файлов`
}

export function StatementUploadPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { companyId } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>(() =>
    DEMO_SEED.map((d) => ({
      ...d,
      file: new File([], d.name),
    })),
  )
  const [analyzing, setAnalyzing] = useState(false)

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  async function processFile(file: File) {
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const isPdfScanRisk = ext === 'pdf'

    if (file.size > MAX_BYTES) {
      setItems((list) => [
        {
          id,
          file,
          name: file.name,
          size: file.size,
          status: 'error',
          progress: 100,
          error: 'Файл больше 20 МБ. Разбейте период или сожмите выгрузку.',
        },
        ...list.filter((x) => !x.id.startsWith('demo')),
      ])
      return
    }

    setItems((list) => [
      {
        id,
        file,
        name: file.name,
        size: file.size,
        status: 'processing',
        progress: 12,
      },
      ...list.filter((x) => !x.id.startsWith('demo') || x.status === 'done'),
    ])

    // fake progress while uploading
    let p = 12
    const timer = window.setInterval(() => {
      p = Math.min(p + 11, 88)
      updateItem(id, { progress: p })
    }, 180)

    try {
      if (isPdfScanRisk && file.size > 3 * 1024 * 1024) {
        window.clearInterval(timer)
        updateItem(id, {
          status: 'error',
          progress: 100,
          meta: 'не удалось распознать таблицу',
          error:
            'Файл похож на скан без текстового слоя. Скачайте выписку из интернет-банка в Excel или формате 1С (.txt).',
        })
        return
      }
      if (!companyId) throw new Error('Нет компании')
      await importStatement(companyId, file)
      window.clearInterval(timer)
      updateItem(id, { status: 'done', progress: 100, meta: 'импортировано' })
      await qc.invalidateQueries({ queryKey: ['transactions', companyId] })
      await qc.invalidateQueries({ queryKey: ['financials', companyId] })
    } catch (e) {
      window.clearInterval(timer)
      updateItem(id, {
        status: 'error',
        progress: 100,
        error: e instanceof Error ? e.message : 'Не удалось обработать файл',
      })
    }
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list)
    for (const f of arr) void processFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  async function runAnalysis() {
    const ready = items.filter((x) => x.status === 'done')
    if (ready.length === 0) return
    setAnalyzing(true)
    // finish any processing demos
    setItems((list) =>
      list.map((x) =>
        x.status === 'processing' ? { ...x, status: 'done', progress: 100, meta: 'готово' } : x,
      ),
    )
    await new Promise((r) => setTimeout(r, 700))
    setAnalyzing(false)
    navigate('/app/statements')
  }

  const realCount = items.length

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/statements"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Финансовый профиль
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Загрузка выписки
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
            Загрузка банковской выписки
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Нужна выписка за 12 месяцев по всем расчётным счетам
          </Typography>
        </Box>
        <Button
          variant="outlined"
          component={RouterLink}
          to="/app/help"
          sx={{ ...outlineBtn, alignSelf: 'flex-start' }}
        >
          Как выгрузить выписку
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
        <Stack spacing={2}>
          {/* Dropzone */}
          <Box
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            sx={{
              ...tileSx,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: dragging ? '#EF3124' : 'rgba(239,49,36,0.45)',
              bgcolor: dragging ? 'rgba(239,49,36,0.04)' : '#fff',
              textAlign: 'center',
              py: { xs: 3.5, md: 4.5 },
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'rgba(239,49,36,0.08)',
                display: 'grid',
                placeItems: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              <NorthEastRoundedIcon sx={{ color: '#EF3124', fontSize: 26 }} />
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 750, color: '#0B1F35', mb: 0.75 }}>
              Перетащите файлы сюда или выберите на компьютере
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mb: 2, lineHeight: 1.45 }}>
              .xlsx, .csv, .txt (1С), .pdf — до 20 МБ на файл
            </Typography>
            <Button
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              sx={{ ...outlineBtn, px: 2.5 }}
            >
              Выбрать файлы
            </Button>
            <input
              ref={inputRef}
              hidden
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </Box>

          {/* File list */}
          <Box sx={tileSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                }}
              >
                Загруженные файлы
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#9AA5B1', fontWeight: 600 }}>
                {filesLabel(realCount)}
              </Typography>
            </Stack>

            <Stack spacing={1.25}>
              {items.map((item) => (
                <Box key={item.id}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      border:
                        item.status === 'error'
                          ? '1px solid rgba(239,49,36,0.35)'
                          : '1px solid rgba(11,31,53,0.08)',
                      bgcolor: '#fff',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <InsertDriveFileOutlinedIcon
                        sx={{
                          fontSize: 22,
                          color: item.status === 'error' ? '#EF3124' : '#8A96A3',
                          mt: 0.2,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          spacing={1}
                          sx={{ mb: 0.75 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}
                              noWrap
                            >
                              {item.name}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.2 }}>
                              {formatFileSize(item.size)}
                              {item.meta ? ` · ${item.meta}` : ''}
                            </Typography>
                          </Box>
                          <StatusPill status={item.status} progress={item.progress} />
                        </Stack>
                        <Box
                          sx={{
                            height: 6,
                            borderRadius: 999,
                            bgcolor: '#E8EBEE',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${item.progress}%`,
                              height: '100%',
                              borderRadius: 999,
                              bgcolor:
                                item.status === 'done'
                                  ? '#1B8A5A'
                                  : item.status === 'error'
                                    ? '#EF3124'
                                    : '#EF3124',
                              transition: 'width 0.2s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    </Stack>
                  </Box>
                  {item.error && (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                      sx={{
                        mt: 1,
                        px: 1.5,
                        py: 1.15,
                        borderRadius: 2,
                        bgcolor: '#FCE8E6',
                        border: '1px solid rgba(239,49,36,0.2)',
                      }}
                    >
                      <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: '#EF3124', mt: 0.15 }} />
                      <Typography sx={{ fontSize: 13, color: '#8A3A32', lineHeight: 1.45 }}>
                        {item.error}
                      </Typography>
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="contained"
                color="primary"
                disabled={analyzing || !items.some((x) => x.status === 'done')}
                onClick={() => void runAnalysis()}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                  px: 2.5,
                  py: 1.15,
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                {analyzing ? 'Анализ…' : 'Запустить анализ'}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/app/statements')} sx={outlineBtn}>
                Отмена
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: '#9AA5B1' }}>
              Анализ займёт ≈ 1 минуту · данные шифруются и удаляются после обработки
            </Typography>
          </Stack>
        </Stack>

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
              Требования к выписке
            </Typography>
            <Stack spacing={1.15}>
              {[
                { ok: true, text: 'Период не меньше 12 месяцев' },
                { ok: true, text: 'Все расчётные счета компании' },
                { ok: true, text: 'Форматы .xlsx, .csv, 1С .txt' },
                { ok: false, text: 'Без паролей и защиты листа' },
              ].map((r) => (
                <Stack key={r.text} direction="row" spacing={1.1} alignItems="flex-start">
                  {r.ok ? (
                    <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#1B8A5A', mt: 0.15 }} />
                  ) : (
                    <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#EF3124', mt: 0.15 }} />
                  )}
                  <Typography sx={{ fontSize: 13.5, color: '#0B1F35', fontWeight: 600 }}>
                    {r.text}
                  </Typography>
                </Stack>
              ))}
            </Stack>
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
                Подключённые счета
              </Typography>
              <Button
                size="small"
                sx={{
                  color: '#EF3124',
                  fontWeight: 700,
                  textTransform: 'none',
                  minWidth: 0,
                  px: 0.5,
                }}
                onClick={() => inputRef.current?.click()}
              >
                Добавить →
              </Button>
            </Stack>
            <Stack spacing={0}>
              {[
                { name: 'Альфа-Банк', status: 'Подключён', tone: 'ok' as const },
                { name: 'Другой банк', status: 'Не загружено', tone: 'warn' as const },
                { name: 'ИП Петров', status: '—', tone: 'muted' as const },
              ].map((a, i, arr) => (
                <Stack
                  key={a.name}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    py: 1.1,
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                  }}
                >
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                    {a.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color:
                        a.tone === 'ok' ? '#1B8A5A' : a.tone === 'warn' ? '#C45A12' : '#9AA5B1',
                    }}
                  >
                    {a.status}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
