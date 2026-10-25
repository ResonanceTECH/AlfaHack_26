import { Alert, Box, Button, CircularProgress, IconButton, Stack, TextField, Typography } from '@mui/material'
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined'
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined'
import { useState } from 'react'
import { postAiResponseFeedback, type AiAgentResponse } from '@/api/ai'

type Props = {
  data: AiAgentResponse
  /** Show 👍/👎 under the reply */
  feedback?: boolean
  dense?: boolean
}

/**
 * Shared renderer for /ai/explanation and /ai/chat responses.
 * Hides empty lists; does not surface validation_errors / source_id to the client.
 */
export function AiAgentReply({ data, feedback = true, dense }: Props) {
  const requestReasons = data.mainReasons.filter((r) => !r.scope || r.scope === 'request')
  const offerReasons = data.mainReasons.filter((r) => r.scope === 'offer')
  const otherReasons = data.mainReasons.filter(
    (r) => r.scope && r.scope !== 'request' && r.scope !== 'offer',
  )
  const splitByScope = offerReasons.length > 0 && requestReasons.length > 0

  const [fbState, setFbState] = useState<'idle' | 'form' | 'saving' | 'done'>('idle')
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [fbError, setFbError] = useState<string | null>(null)

  async function sendFeedback(value: boolean, withComment?: string) {
    if (!data.responseId || fbState === 'saving' || fbState === 'done') return
    setHelpful(value)
    setFbState('saving')
    setFbError(null)
    try {
      await postAiResponseFeedback(data.responseId, {
        helpful: value,
        comment: withComment?.trim() || undefined,
      })
      setFbState('done')
    } catch {
      setFbError('Не удалось сохранить оценку')
      setFbState('form')
    }
  }

  return (
    <Stack spacing={dense ? 1.25 : 1.75}>
      {!data.scoreComplete && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Оценка построена на неполных данных — решение может измениться после дозагрузки
          сведений.
        </Alert>
      )}

      {data.summary && (
        <Typography
          sx={{
            fontSize: dense ? 14 : 14.5,
            color: '#0B1F35',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
          }}
        >
          {data.summary}
        </Typography>
      )}

      {splitByScope ? (
        <>
          <ReasonGroup title="По исходному запросу" items={requestReasons.map((r) => r.text)} />
          <ReasonGroup title="По предложенным условиям" items={offerReasons.map((r) => r.text)} />
        </>
      ) : (
        data.mainReasons.length > 0 && (
          <ReasonGroup title="Основные причины" items={data.mainReasons.map((r) => r.text)} />
        )
      )}
      {otherReasons.length > 0 && (
        <ReasonGroup title="Другие факторы" items={otherReasons.map((r) => r.text)} />
      )}

      {data.whatToChange.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6B7D', mb: 0.75 }}>
            Что можно изменить
          </Typography>
          <Stack spacing={0.65}>
            {data.whatToChange.map((w, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 13.5,
                  color: '#0B1F35',
                  pl: 1.25,
                  borderLeft: '2px solid rgba(239,49,36,0.35)',
                  lineHeight: 1.45,
                }}
              >
                {w.text}
              </Typography>
            ))}
          </Stack>
          <Typography sx={{ mt: 0.75, fontSize: 12, color: '#8A96A3' }}>
            Предварительные расчёты — текущую заявку не меняют.
          </Typography>
        </Box>
      )}

      {data.nextSteps.length > 0 && (
        <ReasonGroup title="Что дальше" items={data.nextSteps} />
      )}

      {data.disclaimer && (
        <Typography sx={{ fontSize: 12, color: '#8A96A3', lineHeight: 1.45 }}>
          {data.disclaimer}
        </Typography>
      )}

      {feedback && data.responseId && (
        <Box sx={{ pt: 0.5 }}>
          {fbState === 'done' ? (
            <Typography sx={{ fontSize: 12.5, color: '#1B8A5A', fontWeight: 600 }}>
              Спасибо за оценку
            </Typography>
          ) : (
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography sx={{ fontSize: 12.5, color: '#7A8795', mr: 0.5 }}>
                  Ответ полезен?
                </Typography>
                <IconButton
                  size="small"
                  disabled={fbState === 'saving'}
                  onClick={() => {
                    setHelpful(true)
                    setFbState('form')
                  }}
                  aria-label="Полезно"
                  sx={{ color: helpful === true ? '#1B8A5A' : '#5A6B7D' }}
                >
                  <ThumbUpAltOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={fbState === 'saving'}
                  onClick={() => {
                    setHelpful(false)
                    setFbState('form')
                  }}
                  aria-label="Не полезно"
                  sx={{ color: helpful === false ? '#EF3124' : '#5A6B7D' }}
                >
                  <ThumbDownAltOutlinedIcon fontSize="small" />
                </IconButton>
                {fbState === 'saving' && <CircularProgress size={14} />}
              </Stack>
              {fbState === 'form' && helpful != null && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Комментарий (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={fbState === 'saving'}
                    onClick={() => void sendFeedback(helpful, comment)}
                    sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flexShrink: 0 }}
                  >
                    Отправить
                  </Button>
                </Stack>
              )}
              {fbError && (
                <Typography sx={{ fontSize: 12, color: '#C41E14' }}>{fbError}</Typography>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  )
}

function ReasonGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6B7D', mb: 0.65 }}>
        {title}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
        {items.map((t, i) => (
          <Typography
            component="li"
            key={i}
            sx={{ fontSize: 13.5, color: '#0B1F35', lineHeight: 1.45, mb: 0.35 }}
          >
            {t}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
