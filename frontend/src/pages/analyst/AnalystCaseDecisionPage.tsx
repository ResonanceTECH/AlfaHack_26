import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AGREEMENT_STEPS, type AnalystCase } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, statusPill, tileSx } from '@/features/analyst/styles'

export function AnalystCaseDecisionPage() {
  const { caseData: c } = useOutletContext<{ caseData: AnalystCase }>()
  const [confirmed, setConfirmed] = useState(false)
  const [completed, setCompleted] = useState(false)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) 280px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
          Договор и сопровождение
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#8A96A3', mt: 0.35, mb: 2.25 }}>
          Демонстрационный процесс — без интеграции с ЭЦП банка
        </Typography>

        {(confirmed || completed) && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => {
              setConfirmed(false)
              setCompleted(false)
            }}
          >
            {completed
              ? 'Заявка завершена (демо) · статус → COMPLETED'
              : 'Ознакомление подтверждено (демо) · AGREEMENT_CONFIRMED'}
          </Alert>
        )}

        <Stack spacing={0} sx={{ mb: 2.5 }}>
          {AGREEMENT_STEPS.map((s, i) => {
            const done = s.done || (confirmed && s.id === 's3') || (completed && (s.id === 's3' || s.id === 's4'))
            const last = i === AGREEMENT_STEPS.length - 1
            return (
              <Stack
                key={s.id}
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                sx={{ position: 'relative', pb: last ? 0 : 2 }}
              >
                {!last && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 11,
                      top: 26,
                      bottom: 0,
                      width: 2,
                      bgcolor: done ? 'rgba(46,125,50,0.35)' : 'rgba(11,31,53,0.1)',
                    }}
                  />
                )}
                <Box sx={{ pt: 0.15, zIndex: 1, bgcolor: '#fff' }}>
                  {done ? (
                    <CheckCircleRoundedIcon sx={{ fontSize: 24, color: '#2E7D32' }} />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 24, color: '#C5CCD3' }} />
                  )}
                </Box>
                <Box sx={{ pt: 0.15 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: '#0B1F35' }}>
                    {s.title}
                  </Typography>
                  <Box
                    sx={{
                      ...statusPill,
                      mt: 0.6,
                      bgcolor: done ? 'rgba(46,125,50,0.1)' : 'rgba(11,31,53,0.06)',
                      color: done ? '#2E7D32' : '#7A8795',
                    }}
                  >
                    {s.status}
                  </Box>
                </Box>
              </Stack>
            )
          })}
        </Stack>

        <Box
          sx={{
            p: 2,
            borderRadius: 2.5,
            bgcolor: '#F3F5F8',
            border: '1px solid rgba(11,31,53,0.06)',
            mb: 2.25,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: '#fff',
                display: 'grid',
                placeItems: 'center',
                color: '#EF3124',
                flexShrink: 0,
              }}
            >
              <PictureAsPdfRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                Документ: Договор_{c.id}_v1.pdf
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#8A96A3', mt: 0.35 }}>
                Версия 1 · сгенерирован 24.10.2026
              </Typography>
            </Box>
            <Button variant="outlined" size="small" sx={{ ...outlineBtn, flexShrink: 0 }}>
              Открыть PDF
            </Button>
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            sx={primaryBtn}
            disabled={confirmed || completed}
            onClick={() => setConfirmed(true)}
          >
            Подтвердить ознакомление
          </Button>
          <Button
            variant="outlined"
            sx={outlineBtn}
            disabled={!confirmed || completed}
            onClick={() => setCompleted(true)}
          >
            Завершить заявку
          </Button>
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.25 }}>
          Что видит предприниматель
        </Typography>
        <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.25, mb: 2.25 }}>
          {[
            'Подтверждённые условия',
            'Файл договора (демо)',
            'Кнопка подтверждения',
          ].map((t) => (
            <Typography key={t} component="li" sx={{ fontSize: 13.5, color: '#5A6B7D' }}>
              {t}
            </Typography>
          ))}
        </Stack>

        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.25 }}>
          Не видит
        </Typography>
        <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.25 }}>
          {['Внутренние комментарии', 'ML-детали / политики'].map((t) => (
            <Typography key={t} component="li" sx={{ fontSize: 13.5, color: '#5A6B7D' }}>
              {t}
            </Typography>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
