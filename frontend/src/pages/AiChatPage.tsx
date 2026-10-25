import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { formatAiError, postApplicationAiChat, type AiAgentResponse } from '@/api/ai'
import { AiAgentReply } from '@/components/ai/AiAgentReply'
import { useAuth } from '@/contexts/AuthContext'
import { statusLabels } from '@/data/labels'
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney } from '@/utils/format'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
} as const

const QUICK = [
  'Какие факторы повлияли на условия?',
  'Почему мне предложили меньшую сумму?',
  'Что можно изменить в параметрах?',
  'Какие следующие шаги?',
]

type ChatTurn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  agent?: AiAgentResponse
}

const HISTORY_KEY = 'alfa_ai_app_chat'

function historyKey(companyId: string, applicationId: string) {
  return `${HISTORY_KEY}:${companyId}:${applicationId}`
}

function loadHistory(companyId: string, applicationId: string): ChatTurn[] {
  try {
    const raw = localStorage.getItem(historyKey(companyId, applicationId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatTurn[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(companyId: string, applicationId: string, turns: ChatTurn[]) {
  localStorage.setItem(historyKey(companyId, applicationId), JSON.stringify(turns))
}

function appCode(id: string): string {
  return id.toUpperCase().startsWith('ABC') ? id : `ABC-${id.slice(-8).toUpperCase()}`
}

export function AiChatPage() {
  const { user } = useAuth()
  const { companyId, company, apps } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramAppId = searchParams.get('applicationId') || ''

  const selectableApps = useMemo(
    () => apps.filter((a) => a.status !== 'draft'),
    [apps],
  )

  const [applicationId, setApplicationId] = useState(paramAppId)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paramAppId && paramAppId !== applicationId) {
      setApplicationId(paramAppId)
    }
  }, [paramAppId, applicationId])

  useEffect(() => {
    if (!companyId || !applicationId) {
      setMessages([])
      return
    }
    setMessages(loadHistory(companyId, applicationId))
    setError(null)
  }, [companyId, applicationId])

  useEffect(() => {
    if (!companyId || !applicationId) return
    saveHistory(companyId, applicationId, messages)
  }, [companyId, applicationId, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const activeApp = apps.find((a) => a.id === applicationId)

  function pickApplication(nextId: string) {
    setApplicationId(nextId)
    if (nextId) {
      setSearchParams({ applicationId: nextId }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
    setInput('')
    setError(null)
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    if (!companyId) {
      setError('Нет компании для контекста чата')
      return
    }
    if (!applicationId) {
      setError('Выберите заявку — вопросы отправляются по конкретной заявке')
      return
    }

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userTurn])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await postApplicationAiChat(applicationId, content)
      const assistantTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.summary,
        createdAt: new Date().toISOString(),
        agent: res,
      }
      setMessages((prev) => [...prev, assistantTurn])
    } catch (e) {
      setError(formatAiError(e))
    } finally {
      setLoading(false)
    }
  }

  const companyName = company?.name || user?.fullName || 'Компания'

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
            Вопрос по заявке
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            Ответы агента по выбранной заявке · история хранится локально в браузере
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Заявка"
          value={applicationId}
          onChange={(e) => pickApplication(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 280 }, bgcolor: '#fff', borderRadius: 2 }}
        >
          <MenuItem value="">
            <em>Выберите заявку</em>
          </MenuItem>
          {selectableApps.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {appCode(a.id)} · {statusLabels[a.status] ?? a.status} · {formatMoney(a.amount)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!applicationId && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
          Выберите заявку или откройте чат из карточки («Задать вопрос по заявке»).
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box
          sx={{
            ...tileSx,
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 520, md: 640 },
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(11,31,53,0.06)' }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: '#0B1F35',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 20, color: '#EF3124' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0B1F35', lineHeight: 1.25 }}>
                AI по заявке
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.2 }} noWrap>
                {applicationId
                  ? `${appCode(applicationId)} · ${companyName}`
                  : 'Заявка не выбрана'}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
            <Stack spacing={1.5}>
              {messages.length === 0 && applicationId && (
                <Typography sx={{ fontSize: 13.5, color: '#7A8795' }}>
                  Спросите про решение, сумму, срок или следующие шаги по этой заявке.
                </Typography>
              )}
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: { xs: '92%', md: '85%' },
                  }}
                >
                  {m.role === 'user' ? (
                    <Box
                      sx={{
                        px: 1.75,
                        py: 1.35,
                        borderRadius: 2.5,
                        bgcolor: '#0B1F35',
                        color: '#fff',
                        whiteSpace: 'pre-wrap',
                        borderBottomRightRadius: 6,
                      }}
                    >
                      <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        px: 1.75,
                        py: 1.35,
                        borderRadius: 2.5,
                        bgcolor: '#F3F5F8',
                        color: '#0B1F35',
                        borderBottomLeftRadius: 6,
                      }}
                    >
                      {m.agent ? (
                        <AiAgentReply data={m.agent} dense />
                      ) : (
                        <Typography sx={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              ))}
              {loading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#9AA5B1' }}>
                  <CircularProgress size={16} sx={{ color: '#EF3124' }} />
                  <Typography sx={{ fontSize: 13 }}>Готовлю ответ…</Typography>
                </Stack>
              )}
              <div ref={bottomRef} />
            </Stack>
          </Box>

          <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{
                mb: 1.25,
                px: 1.5,
                py: 1.1,
                borderRadius: 2,
                bgcolor: '#FFF6EB',
                border: '1px solid rgba(196,106,18,0.18)',
              }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#C45A12', mt: 0.15 }} />
              <Typography sx={{ fontSize: 12.5, color: '#8A5A28', lineHeight: 1.45 }}>
                Справочный ответ агента, не официальное решение банка.
              </Typography>
            </Stack>

            <TextField
              fullWidth
              placeholder={
                applicationId ? 'Вопрос по заявке…' : 'Сначала выберите заявку'
              }
              value={input}
              disabled={!applicationId || loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  bgcolor: '#F3F5F8',
                  pr: 0.75,
                  '& fieldset': { borderColor: 'transparent' },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => void send()}
                      disabled={loading || !input.trim() || !applicationId}
                      sx={{
                        bgcolor: '#EF3124',
                        color: '#fff',
                        borderRadius: 1.75,
                        width: 40,
                        height: 40,
                        '&:hover': { bgcolor: '#D92B1F' },
                        '&.Mui-disabled': { bgcolor: 'rgba(239,49,36,0.35)', color: '#fff' },
                      }}
                    >
                      <SendRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        <Stack spacing={2}>
          <Box sx={{ ...tileSx, p: 2.25 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1.5,
              }}
            >
              Контекст заявки
            </Typography>
            {activeApp ? (
              <Stack spacing={0}>
                {[
                  { k: 'Статус', v: statusLabels[activeApp.status] ?? activeApp.status },
                  { k: 'Запрошено', v: formatMoney(activeApp.amount) },
                  { k: 'Срок', v: `${activeApp.termMonths} мес.` },
                  { k: 'Продукт', v: activeApp.productName || activeApp.productId || '—' },
                ].map((row, i, arr) => (
                  <Stack
                    key={row.k}
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{
                      py: 1.05,
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: '#9AA5B1' }}>{row.k}</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                      {row.v}
                    </Typography>
                  </Stack>
                ))}
                <Button
                  component={RouterLink}
                  to={`/app/applications/${activeApp.id}`}
                  sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, color: '#EF3124' }}
                >
                  Открыть карточку
                </Button>
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 13.5, color: '#7A8795' }}>
                Выберите заявку, чтобы зафиксировать контекст.
              </Typography>
            )}
          </Box>

          <Box sx={{ ...tileSx, p: 2.25 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              Быстрые вопросы
            </Typography>
            <Stack spacing={1}>
              {QUICK.map((q) => (
                <Button
                  key={q}
                  fullWidth
                  disabled={!applicationId || loading}
                  onClick={() => void send(q)}
                  endIcon={<ArrowForwardIosRoundedIcon sx={{ fontSize: '12px !important' }} />}
                  sx={{
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: '#0B1F35',
                    bgcolor: '#F3F5F8',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1.15,
                    '&:hover': { bgcolor: '#E8EBEE' },
                  }}
                >
                  {q}
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
