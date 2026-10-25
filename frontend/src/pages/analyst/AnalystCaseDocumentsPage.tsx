import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import { useState } from 'react'
import { DOCUMENTS } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'

const statusUi = {
  accepted: { label: 'Принят', bg: 'rgba(46,125,50,0.12)', color: '#2E7D32' },
  review: { label: 'Проверяется', bg: 'rgba(230,160,24,0.16)', color: '#B86B12' },
  missing: { label: 'Не загружен', bg: 'rgba(11,31,53,0.06)', color: '#7A8795' },
  replace: { label: 'Требуется замена', bg: 'rgba(239,49,36,0.1)', color: '#EF3124' },
} as const

export function AnalystCaseDocumentsPage() {
  const [selected, setSelected] = useState(DOCUMENTS[6]?.id ?? DOCUMENTS[0]!.id)
  const [comment, setComment] = useState('Нечитаемая печать на стр. 2 — нужна замена')
  const doc = DOCUMENTS.find((d) => d.id === selected) ?? DOCUMENTS[0]!

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 1.75 }}>
        Комплект документов
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.25}>
          {DOCUMENTS.map((d) => {
            const st = statusUi[d.status]
            const active = d.id === selected
            return (
              <Box
                key={d.id}
                onClick={() => setSelected(d.id)}
                sx={{
                  ...tileSx,
                  py: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderColor: active ? 'rgba(239,49,36,0.35)' : 'rgba(11,31,53,0.06)',
                  boxShadow: active ? '0 0 0 1px rgba(239,49,36,0.2)' : tileSx.boxShadow,
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
                    color: '#EF3124',
                    flexShrink: 0,
                  }}
                >
                  {d.kind === 'CSV' ? (
                    <TableChartRoundedIcon sx={{ fontSize: 22 }} />
                  ) : (
                    <PictureAsPdfRoundedIcon sx={{ fontSize: 22 }} />
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{d.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>
                    {d.kind} · {d.size}
                  </Typography>
                </Box>
                <Box sx={{ ...statusPill, bgcolor: st.bg, color: st.color }}>{st.label}</Box>
              </Box>
            )
          })}
        </Stack>

        <Box sx={tileSx}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
            Предпросмотр / действия
          </Typography>
          <Box
            sx={{
              height: 160,
              borderRadius: 2,
              bgcolor: '#F0F2F5',
              display: 'grid',
              placeItems: 'center',
              mb: 1.75,
              border: '1px dashed rgba(11,31,53,0.12)',
            }}
          >
            <Typography sx={{ fontSize: 13, color: '#8A96A3', textAlign: 'center', px: 2 }}>
              {doc.status === 'missing' ? 'Файл не загружен' : `Превью: ${doc.name}`}
            </Typography>
          </Box>
          <Stack spacing={1}>
            <Button fullWidth variant="contained" sx={primaryBtn} disabled={doc.status === 'missing'}>
              Принять
            </Button>
            <Button
              fullWidth
              variant="outlined"
              sx={{
                ...outlineBtn,
                borderColor: 'rgba(239,49,36,0.35)',
                color: '#EF3124',
                bgcolor: 'rgba(239,49,36,0.04)',
              }}
              disabled={doc.status === 'missing'}
            >
              Отклонить
            </Button>
            <Button fullWidth variant="outlined" sx={outlineBtn}>
              Запросить повторно
            </Button>
          </Stack>
          <TextField
            multiline
            minRows={3}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            label="Комментарий аналитика"
            sx={{ mt: 1.75, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Typography sx={{ mt: 1.5, fontSize: 12, color: '#8A96A3' }}>
            Status: incomplete · 1 missing · 1 for replacement
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
