import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AnalystCase } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, tileSx } from '@/features/analyst/styles'

type Msg = { role: 'ai' | 'user'; text: string }

export function AnalystCaseAiPage() {
  const { caseData: c } = useOutletContext<{ caseData: AnalystCase }>()
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'ai',
      text: `Кратко по ${c.id}: компания ${c.company}, ${c.product} ${c.amount.toLocaleString('ru-RU')} ₽ на ${c.termMonths} мес. Финансы устойчивые (DSCR 1.42), есть 1 документ на замену и 1 warning по кассовым разрывам. Рекомендую закрыть комплект и вынести предварительное одобрение.`,
    },
  ])

  function send() {
    const t = input.trim()
    if (!t) return
    setMsgs((m) => [
      ...m,
      { role: 'user', text: t },
      {
        role: 'ai',
        text: 'Демо-ответ: учёл ваш вопрос. Для прод-версии здесь будет вызов /ai с контекстом заявки и RBAC аналитика.',
      },
    ])
    setInput('')
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 260px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={{ ...tileSx, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#EF3124', fontSize: 22 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>AI Copilot</Typography>
        </Stack>
        <Stack spacing={1.25} sx={{ flex: 1, mb: 2 }}>
          {msgs.map((m, i) => (
            <Box
              key={i}
              sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                px: 1.5,
                py: 1.15,
                borderRadius: 2,
                bgcolor: m.role === 'user' ? 'rgba(239,49,36,0.08)' : '#F7F8FA',
                color: '#0B1F35',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {m.text}
            </Box>
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="Спросить по заявке…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
          />
          <Button variant="contained" sx={primaryBtn} onClick={send}>
            Отправить
          </Button>
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.25 }}>
          Быстрые запросы
        </Typography>
        <Stack spacing={1}>
          {[
            'Сформируй резюме для решения',
            'Какие документы критичны?',
            'Сравни с политикой CP-2026.10',
          ].map((q) => (
            <Button
              key={q}
              fullWidth
              variant="outlined"
              sx={{ ...outlineBtn, justifyContent: 'flex-start', textAlign: 'left', py: 1.1 }}
              onClick={() => {
                setInput(q)
              }}
            >
              {q}
            </Button>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
