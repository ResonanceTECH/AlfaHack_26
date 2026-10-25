import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
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
  const [selected, setSelected] = useState(
    () => DOCUMENTS.find((d) => d.status === 'replace')?.id ?? DOCUMENTS[0]!.id,
  )
  const [comment, setComment] = useState('Нечитаемая печать на стр. 2 — нужна замена')
  const doc = DOCUMENTS.find((d) => d.id === selected) ?? DOCUMENTS[0]!

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
        {DOCUMENTS.map((d, i) => {
          const st = statusUi[d.status]
          const active = d.id === selected
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
                borderTop: i === 0 ? '1px solid rgba(11,31,53,0.06)' : '1px solid rgba(11,31,53,0.06)',
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
                  color: d.status === 'missing' ? '#9AA5B1' : '#EF3124',
                  flexShrink: 0,
                }}
              >
                {d.status === 'missing' ? (
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 22 }} />
                ) : d.kind === 'CSV' ? (
                  <TableChartRoundedIcon sx={{ fontSize: 22 }} />
                ) : (
                  <PictureAsPdfRoundedIcon sx={{ fontSize: 22 }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>{d.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#8A96A3' }}>
                  {d.status === 'missing' ? 'файл отсутствует' : `${d.kind} · ${d.size}`}
                </Typography>
              </Box>
              <Box sx={{ ...statusPill, bgcolor: st.bg, color: st.color }}>{st.label}</Box>
            </Box>
          )
        })}
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          Предпросмотр / действия
        </Typography>
        <Box
          sx={{
            height: 180,
            borderRadius: 2,
            bgcolor: '#EEF1F4',
            display: 'grid',
            placeItems: 'center',
            mb: 1.75,
            border: '1px solid rgba(11,31,53,0.06)',
          }}
        >
          <Typography sx={{ fontSize: 13, color: '#8A96A3', textAlign: 'center', px: 2 }}>
            {doc.status === 'missing' ? 'Файл не загружен' : 'PDF preview'}
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
              borderColor: 'rgba(239,49,36,0.3)',
              color: '#EF3124',
              bgcolor: 'rgba(239,49,36,0.06)',
              '&:hover': { bgcolor: 'rgba(239,49,36,0.1)', borderColor: 'rgba(239,49,36,0.4)' },
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
        <Typography sx={{ mt: 1.5, fontSize: 12.5, fontWeight: 600, color: '#C45A12', lineHeight: 1.45 }}>
          Статус комплекта: неполный · 1 отсутствует · 1 на замену
        </Typography>
      </Box>
    </Box>
  )
}
