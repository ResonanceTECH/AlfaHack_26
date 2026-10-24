import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { Disclaimer } from '@/components/common/Disclaimer'
import type { AiChatMessage } from '@/types'
import { aiChat } from '@/api/statements'
import { useAppStore } from '@/hooks/useAppStore'

export function AiChatPage() {
  const { companyId } = useAppStore()
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Я AI-консультант Alfa Credit. Опишите бизнес-цель текстом — уточню параметры и направлю к подбору.',
      createdAt: new Date().toISOString(),
      suggestedActions: [
        { label: 'Создать цель', path: '/app/goals' },
        { label: 'К рекомендациям', path: '/app/recommendations' },
      ],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    if (!companyId) {
      setError('Нет компании для контекста чата')
      return
    }
    const userMsg: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await aiChat({
        companyId,
        message: content,
        conversationId,
      })
      setConversationId(res.conversationId)
      setMessages((m) => [...m, res.message])
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка AI')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="AI-консультант"
        subtitle="Ответы с бэкенда (/ai/chat). Платежи считает расчётный движок, не модель."
        crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'AI' }]}
      />
      <Disclaimer dense />
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={1}
        sx={{
          mt: 2,
          height: { xs: '70vh', md: 560 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={1.5}>
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: m.role === 'user' ? 'primary.main' : 'rgba(11,31,53,0.04)',
                  color: m.role === 'user' ? '#fff' : 'text.primary',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <Typography variant="body2">{m.content}</Typography>
                {m.sources && m.role === 'assistant' && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {m.sources.map((s) => (
                      <Chip key={s} size="small" label={s} sx={{ bgcolor: 'background.paper' }} />
                    ))}
                  </Stack>
                )}
                {m.suggestedActions && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {m.suggestedActions.map((a) =>
                      a.path === '/app/ai' ? (
                        <Button
                          key={a.label}
                          size="small"
                          variant="outlined"
                          onClick={() => void send(a.label)}
                          sx={{ bgcolor: 'background.paper' }}
                        >
                          {a.label}
                        </Button>
                      ) : (
                        <Button
                          key={a.label}
                          size="small"
                          component={RouterLink}
                          to={a.path}
                          variant="outlined"
                          sx={{ bgcolor: 'background.paper' }}
                        >
                          {a.label}
                        </Button>
                      ),
                    )}
                  </Stack>
                )}
              </Box>
            ))}
            {loading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="caption" color="text.secondary">
                  Думаю…
                </Typography>
              </Stack>
            )}
            <div ref={bottomRef} />
          </Stack>
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Например: нужно 2,5 млн на закупку товаров к сезону"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <Button
              variant="contained"
              endIcon={<SendIcon />}
              onClick={() => void send()}
              disabled={loading}
            >
              Отправить
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
