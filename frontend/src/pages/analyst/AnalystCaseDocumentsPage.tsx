import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { createAnalystDocumentRequest } from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { analystStatusLabel } from '@/features/analyst/map'
import { primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'
import { formatFileSize } from '@/utils/format'

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'PASSPORT', label: 'Паспорт' },
  { value: 'EGRUL', label: 'Выписка ЕГРЮЛ / ЕГРИП' },
  { value: 'BANK_STATEMENT', label: 'Банковская выписка' },
  { value: 'FINANCIAL_REPORT', label: 'Финансовая отчётность' },
  { value: 'LEASE_AGREEMENT', label: 'Договор аренды' },
  { value: 'OTHER', label: 'Другой документ' },
]

const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((t) => [t.value, t.label]),
)

function docTypeLabel(type?: string | null): string {
  if (!type) return 'Документ'
  return DOC_TYPE_LABEL[type.toUpperCase()] || type
}

type DocRow = {
  id: string
  name: string
  size: string
  status: 'accepted' | 'review' | 'missing' | 'replace' | 'requested'
  kind: string
  meta?: string
}

const statusUi = {
  accepted: { label: 'Принят', bg: 'rgba(46,125,50,0.12)', color: '#2E7D32' },
  review: { label: 'Проверяется', bg: 'rgba(230,160,24,0.16)', color: '#B86B12' },
  missing: { label: 'Не загружен', bg: 'rgba(11,31,53,0.06)', color: '#7A8795' },
  replace: { label: 'Требуется замена', bg: 'rgba(239,49,36,0.1)', color: '#EF3124' },
  requested: { label: 'Запрошен', bg: 'rgba(239,49,36,0.1)', color: '#EF3124' },
} as const

function mapDocStatus(s: string): DocRow['status'] {
  const x = s.toLowerCase()
  if (x === 'accepted' || x === 'verified') return 'accepted'
  if (x === 'rejected' || x === 'replace') return 'replace'
  if (x === 'uploaded' || x === 'pending' || x === 'review') return 'review'
  return 'review'
}

export function AnalystCaseDocumentsPage() {
  const { card, applicationId } = useOutletContext<AnalystCaseOutlet>()
  const qc = useQueryClient()
  const canRequest = card.allowedActions.includes('REQUEST_DOCS')

  const rows: DocRow[] = useMemo(() => {
    const uploaded = card.application.documents.map((d) => ({
      id: d.id,
      name: d.name && d.name !== d.type ? d.name : docTypeLabel(d.type),
      size: d.size ? formatFileSize(d.size) : '—',
      status: mapDocStatus(d.status),
      kind: 'FILE',
      meta: docTypeLabel(d.type),
    }))
    const requested = card.openDocumentRequests.map((r, i) => ({
      id: String(r.id ?? `req-${i}`),
      name: docTypeLabel(String(r.docType ?? r.doc_type ?? '')),
      size: '—',
      status: 'requested' as const,
      kind: 'REQUEST',
      meta: String(r.comment ?? r.status ?? ''),
    }))
    return [...uploaded, ...requested]
  }, [card])

  const [selected, setSelected] = useState(() => rows[0]?.id ?? '')
  const [docType, setDocType] = useState('LEASE_AGREEMENT')
  const [comment, setComment] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const doc = rows.find((d) => d.id === selected) ?? rows[0]

  const requestM = useMutation({
    mutationFn: () =>
      createAnalystDocumentRequest(applicationId, {
        docType,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      setFlash(`Запрос «${docTypeLabel(docType)}» отправлен`)
      setComment('')
      void qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
    },
    onError: () => setFlash('Ошибка запроса документа'),
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={{ ...tileSx, p: 0, overflow: 'hidden' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', px: 2.25, pt: 2, pb: 1.25 }}>
          Комплект документов
        </Typography>
        {rows.length === 0 && (
          <Typography sx={{ px: 2.25, py: 3, color: '#8A96A3', fontSize: 14 }}>
            Документов и открытых запросов нет
          </Typography>
        )}
        {rows.map((d) => {
          const s = statusUi[d.status]
          const active = d.id === (doc?.id ?? selected)
          return (
            <Box
              key={d.id}
              onClick={() => setSelected(d.id)}
              sx={{
                px: 2.25,
                py: 1.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderTop: '1px solid rgba(11,31,53,0.06)',
                bgcolor: active ? 'rgba(239,49,36,0.03)' : 'transparent',
                boxShadow: active ? 'inset 3px 0 0 #EF3124' : 'none',
                '&:hover': { bgcolor: active ? 'rgba(239,49,36,0.04)' : 'rgba(11,31,53,0.02)' },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#F7F8FA',
                  display: 'grid',
                  placeItems: 'center',
                  color: d.status === 'missing' || d.status === 'requested' ? '#9AA5B1' : '#EF3124',
                  flexShrink: 0,
                }}
              >
                {d.status === 'requested' || d.status === 'missing' ? (
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 22 }} />
                ) : (
                  <PictureAsPdfRoundedIcon sx={{ fontSize: 22 }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{d.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>
                  {d.meta || `${d.kind} · ${d.size}`}
                </Typography>
              </Box>
              <Box sx={{ ...statusPill, bgcolor: s.bg, color: s.color }}>{s.label}</Box>
            </Box>
          )
        })}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          Запрос документа
        </Typography>
        {flash && (
          <Alert
            severity={flash.startsWith('Ошибка') ? 'error' : 'success'}
            sx={{ mb: 1.5 }}
            onClose={() => setFlash(null)}
          >
            {flash}
          </Alert>
        )}
        <TextField
          select
          fullWidth
          size="small"
          label="Тип документа"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        >
          {DOC_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          multiline
          minRows={3}
          fullWidth
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          label="Комментарий аналитика"
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Button
          fullWidth
          variant="contained"
          sx={primaryBtn}
          disabled={!canRequest || requestM.isPending}
          onClick={() => requestM.mutate()}
        >
          {requestM.isPending ? <CircularProgress size={18} color="inherit" /> : 'Запросить'}
        </Button>
        {!canRequest && (
          <Typography sx={{ mt: 1.25, fontSize: 12.5, color: '#C45A12' }}>
            Запрос документов сейчас недоступен для статуса «
            {analystStatusLabel(card.application.statusLabel)}»
          </Typography>
        )}
      </Box>
    </Box>
  )
}
