import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { aiChat } from '@/api/statements'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney } from '@/utils/format'
import type { AiChatMessage } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
} as const

const DEMO_THREAD: AiChatMessage[] = [
  {
    id: 'u1',
    role: 'user',
    content: 'Почему банк предложил 3 млн вместо 5 млн ₽?',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a1',
    role: 'assistant',
    content:
      'По текущей выручке и обязательствам комфортная нагрузка ближе к 3 млн ₽: платёж укладывается в ~25–30% среднемесячной выручки. На 5 млн сезонность января–февраля даёт повышенный риск кассовых разрывов.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    role: 'user',
    content: 'А как закрыть остальные 2 млн?',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a2',
    role: 'assistant',
    content:
      'Часто комбинируют: овердрафт до ~1 млн ₽ + собственные средства / отсрочка поставщику. Могу посчитать комбинированный сценарий и сравнить платёж с аннуитетом.',
    createdAt: new Date().toISOString(),
    suggestedActions: [
      { label: 'Рассчитать комбинированный сценарий', path: '/app/scenarios' },
      { label: 'Какие документы нужны', path: '/app/ai' },
      { label: 'Что такое аннуитет?', path: '/app/ai' },
    ],
  },
]

const QUICK = [
  'Что влияет на ставку?',
  'Можно ли досрочно погасить?',
  'Нужен ли залог?',
  'Как рассчитывается платёж?',
]

const SUGGEST_CHIPS = [
  'Рассчитать комбинированный сценарий',
  'Какие документы нужны',
  'Что такое аннуитет?',
]

const AI_THREADS_KEY = 'alfa_ai_threads'

type ChatThread = {
  id: string
  title: string
  messages: AiChatMessage[]
  conversationId?: string
  updatedAt: string
}

function moneyShort(n: number) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} млн ₽`
  }
  return formatMoney(n)
}

function threadsKey(companyId: string) {
  return `${AI_THREADS_KEY}:${companyId}`
}

function welcomeMessage(): AiChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'Здравствуйте! Я AI-консультант Альфа. Спросите про ставку, залог, платёж или документы по заявке — отвечу по контексту компании.',
    createdAt: new Date().toISOString(),
  }
}

function titleFromMessages(messages: AiChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Новый диалог'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}

function loadThreads(companyId: string): { threads: ChatThread[]; activeId: string } {
  try {
    const raw = localStorage.getItem(threadsKey(companyId))
    if (raw) {
      const parsed = JSON.parse(raw) as { threads: ChatThread[]; activeId: string }
      if (Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        return {
          threads: parsed.threads,
          activeId: parsed.threads.some((t) => t.id === parsed.activeId)
            ? parsed.activeId
            : parsed.threads[0]!.id,
        }
      }
    }
  } catch {
    /* ignore */
  }
  const demo: ChatThread = {
    id: 'demo',
    title: titleFromMessages(DEMO_THREAD),
    messages: DEMO_THREAD,
    updatedAt: new Date().toISOString(),
  }
  return { threads: [demo], activeId: demo.id }
}

function persistThreads(companyId: string, threads: ChatThread[], activeId: string) {
  localStorage.setItem(threadsKey(companyId), JSON.stringify({ threads, activeId }))
}

export function AiChatPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { companyId, company, financials, goal, apps } = useAppStore()

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: Boolean(user),
  })
  const activeCompany =
    company ??
    companiesQ.data?.find((c) => c.id === companyId) ??
    companiesQ.data?.[0] ??
    null

  const activeApp = useMemo(
    () =>
      apps.find((a) =>
        ['submitted', 'in_review', 'docs_requested', 'approved'].includes(a.status),
      ) ?? apps[0],
    [apps],
  )

  const appCode = activeApp
    ? activeApp.id.toUpperCase().startsWith('ABC')
      ? activeApp.id
      : `ABC-2026-1042`
    : 'ABC-2026-1042'

  const requested = goal?.requiredAmount || activeApp?.amount || 5_000_000
  const offered = activeApp ? Math.round((activeApp.amount || requested) * 0.6) : 3_000_000
  const revenue12 = financials.avgMonthlyRevenue
    ? financials.avgMonthlyRevenue * 12
    : 18_400_000

  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!companyId) {
      setThreads([])
      setActiveId('')
      return
    }
    const loaded = loadThreads(companyId)
    setThreads(loaded.threads)
    setActiveId(loaded.activeId)
  }, [companyId])

  useEffect(() => {
    if (!companyId || threads.length === 0 || !activeId) return
    persistThreads(companyId, threads, activeId)
  }, [companyId, threads, activeId])

  const activeThread = threads.find((t) => t.id === activeId) ?? threads[0]
  const messages = activeThread?.messages ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, activeId])

  function patchThread(threadId: string, patch: Partial<ChatThread>) {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    )
  }

  function startNewDialog() {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: 'Новый диалог',
      messages: [welcomeMessage()],
      updatedAt: new Date().toISOString(),
    }
    setThreads((prev) => [thread, ...prev])
    setActiveId(thread.id)
    setInput('')
    setError(null)
  }

  function selectThread(id: string) {
    setActiveId(id)
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
    const thread = activeThread
    if (!thread) {
      startNewDialog()
      return
    }
    const threadId = thread.id
    const prevConversationId = thread.conversationId
    const userMsg: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    const nextMessages = [...thread.messages, userMsg]
    patchThread(threadId, {
      messages: nextMessages,
      title:
        thread.title === 'Новый диалог' || thread.id === 'demo'
          ? titleFromMessages(nextMessages)
          : thread.title,
    })
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await aiChat({
        companyId,
        message: content,
        conversationId: prevConversationId,
      })
      patchThread(threadId, {
        conversationId: res.conversationId,
        messages: [...nextMessages, res.message],
      })
    } catch (e) {
      const fallback: AiChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          e instanceof Error && /404|Network|Failed/i.test(e.message)
            ? 'Пока отвечу по данным профиля: сверьте запрошенную сумму с предложенной в блоке справа и сравните сценарии в разделе «Сценарии и расчёты».'
            : e instanceof Error
              ? e.message
              : 'Ошибка AI',
        createdAt: new Date().toISOString(),
        suggestedActions: [
          { label: 'К сценариям', path: '/app/scenarios' },
          { label: 'К рекомендациям', path: '/app/recommendations' },
        ],
      }
      if (!(e instanceof Error) || /404|Network|Failed|500|502|503/i.test(e.message)) {
        patchThread(threadId, { messages: [...nextMessages, fallback] })
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const companyName = activeCompany?.name || 'ООО «Кофе Плюс»'
  const contextRows = [
    { k: 'Цель', v: goal?.title || 'Оборотные' },
    { k: 'Запрошено', v: formatMoney(requested) },
    { k: 'Предложено', v: formatMoney(offered) },
    { k: 'Выручка 12 мес', v: moneyShort(revenue12) },
  ]

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
            AI-консультант
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            Объясняет условия и помогает выбрать продукт · решения принимает банк
          </Typography>
        </Box>
        <Button variant="contained" color="primary" onClick={startNewDialog} sx={{ alignSelf: 'flex-start' }}>
          + Новый диалог
        </Button>
      </Stack>

      {threads.length > 1 && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {threads.map((t) => {
            const active = t.id === activeId
            return (
              <Button
                key={t.id}
                size="small"
                variant={active ? 'contained' : 'outlined'}
                color={active ? 'secondary' : 'inherit'}
                onClick={() => selectThread(t.id)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 650,
                  fontSize: 12.5,
                  maxWidth: 220,
                  borderColor: active ? undefined : 'rgba(11,31,53,0.14)',
                  bgcolor: active ? undefined : '#fff',
                  color: active ? undefined : '#0B1F35',
                }}
              >
                <Typography noWrap sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
                  {t.title}
                </Typography>
              </Button>
            )
          })}
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
          {error}
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
        {/* ——— Chat ——— */}
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
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid rgba(11,31,53,0.06)',
            }}
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
                AI-консультант Альфа
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.2 }} noWrap>
                Контекст: {appCode} · {companyName}
              </Typography>
            </Box>
            <Box
              sx={{
                px: 1.1,
                py: 0.4,
                borderRadius: 999,
                bgcolor: '#EEF1F4',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#5A6B7D',
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              Не принимает решения
            </Box>
          </Stack>

          <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
            <Stack spacing={1.5}>
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: { xs: '92%', md: '78%' },
                  }}
                >
                  <Box
                    sx={{
                      px: 1.75,
                      py: 1.35,
                      borderRadius: 2.5,
                      bgcolor: m.role === 'user' ? '#0B1F35' : '#F3F5F8',
                      color: m.role === 'user' ? '#fff' : '#0B1F35',
                      whiteSpace: 'pre-wrap',
                      borderBottomRightRadius: m.role === 'user' ? 6 : 20,
                      borderBottomLeftRadius: m.role === 'assistant' ? 6 : 20,
                    }}
                  >
                    <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</Typography>
                  </Box>
                  {m.role === 'assistant' && m.suggestedActions && m.id === messages[messages.length - 1]?.id && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                      {m.suggestedActions.map((a) => (
                        <Button
                          key={a.label}
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            if (a.path === '/app/ai') void send(a.label)
                            else navigate(a.path)
                          }}
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: 12.5,
                            borderColor: 'rgba(11,31,53,0.14)',
                            color: '#0B1F35',
                            bgcolor: '#fff',
                            px: 1.5,
                          }}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}

              {!messages.some((m) => m.suggestedActions?.length) && messages.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {SUGGEST_CHIPS.map((label) => (
                    <Button
                      key={label}
                      size="small"
                      variant="outlined"
                      onClick={() => void send(label)}
                      sx={{
                        borderRadius: 999,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: 12.5,
                        borderColor: 'rgba(11,31,53,0.14)',
                        color: '#0B1F35',
                        bgcolor: '#fff',
                        px: 1.5,
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </Stack>
              )}

              {loading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#9AA5B1' }}>
                  <CircularProgress size={16} sx={{ color: '#EF3124' }} />
                  <Typography sx={{ fontSize: 13 }}>Думаю…</Typography>
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
                Ответы AI носят справочный характер. Не используйте их как кредитное решение или
                вероятность одобрения.
              </Typography>
            </Stack>

            <TextField
              fullWidth
              placeholder="Задайте вопрос о кредите..."
              value={input}
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
                  '&:hover fieldset': { borderColor: 'rgba(11,31,53,0.12)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(239,49,36,0.45)' },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => void send()}
                      disabled={loading || !input.trim()}
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

        {/* ——— Right column ——— */}
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
              Контекст, который учитывает AI
            </Typography>
            <Stack spacing={0}>
              {contextRows.map((row, i) => (
                <Stack
                  key={row.k}
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                  sx={{
                    py: 1.05,
                    borderBottom:
                      i < contextRows.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: '#9AA5B1' }}>{row.k}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
                    {row.v}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1.5 }}>
              Данные берутся из вашего профиля
            </Typography>
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
              Источники ответа
            </Typography>
            <Stack spacing={0}>
              {[
                {
                  title: 'Условия продукта «Бизнес-Оборот»',
                  meta: 'Каталог продуктов v2026.4',
                  icon: <DescriptionOutlinedIcon sx={{ fontSize: 20, color: '#EF3124' }} />,
                  to: '/app/recommendations',
                },
                {
                  title: `Предложение ${appCode}`,
                  meta: 'Предварительное решение',
                  icon: <DescriptionOutlinedIcon sx={{ fontSize: 20, color: '#EF3124' }} />,
                  to: activeApp ? `/app/applications/${activeApp.id}` : '/app/applications',
                },
                {
                  title: 'Ваш финансовый профиль',
                  meta: 'Обновлён 22.10.2026',
                  icon: <InsightsOutlinedIcon sx={{ fontSize: 20, color: '#EF3124' }} />,
                  to: '/app/statements',
                },
              ].map((s, i, arr) => (
                <Stack
                  key={s.title}
                  component={RouterLink}
                  to={s.to}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                  sx={{
                    py: 1.2,
                    textDecoration: 'none',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                    '&:hover .src-title': { color: '#EF3124' },
                  }}
                >
                  <Box sx={{ mt: 0.15 }}>{s.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      className="src-title"
                      sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0B1F35',
                        lineHeight: 1.3,
                        transition: 'color 0.12s',
                      }}
                    >
                      {s.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.25 }}>
                      {s.meta}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
