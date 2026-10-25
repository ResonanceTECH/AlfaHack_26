import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchAnalystComments, postAnalystComment } from '@/api/analyst'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { useAuth } from '@/contexts/AuthContext'
import { formatHistoryAt } from '@/features/analyst/map'
import { outlineBtn, primaryBtn, tileSx } from '@/features/analyst/styles'

type LocalAiMsg = { role: 'ai' | 'user'; text: string }

export function AnalystCaseAiPage() {
  const { caseData: c, card, applicationId } = useOutletContext<AnalystCaseOutlet>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'client' | 'ai'>('client')
  const [input, setInput] = useState('')
  const [internalOnly, setInternalOnly] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const commentsQ = useQuery({
    queryKey: ['analyst', 'comments', applicationId],
    queryFn: () => fetchAnalystComments(applicationId),
    enabled: Boolean(applicationId),
    refetchInterval: mode === 'client' ? 12_000 : false,
  })

  const thread = useMemo(() => {
    const rows = commentsQ.data ?? []
    // в режиме клиента показываем публичные + свои внутренние; ответы клиента всегда public
    return rows.filter((m) => !m.isInternal || mode === 'client')
  }, [commentsQ.data, mode])

  const clientQuestions = useMemo(
    () =>
      (commentsQ.data ?? []).filter((m) => {
        const role = m.authorRole.toUpperCase()
        return (
          !m.isInternal &&
          (role.includes('ENTREPRENEUR') ||
            role.includes('ACCOUNTANT') ||
            role === 'OWNER' ||
            role === 'MEMBER')
        )
      }),
    [commentsQ.data],
  )

  const summary =
    card.application.aiSummary ||
    `Кратко по ${c.number || c.id}: ${c.company}, ${c.product}, ${c.amount.toLocaleString('ru-RU')} ₽ на ${c.termMonths} мес. Проверки: ${card.checksSummary.passed} ок${card.checksSummary.warnings ? `, замечаний ${card.checksSummary.warnings}` : ''}.`

  const [aiMsgs, setAiMsgs] = useState<LocalAiMsg[]>([{ role: 'ai', text: summary }])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, aiMsgs.length, mode])

  const postM = useMutation({
    mutationFn: () =>
      postAnalystComment(applicationId, {
        text: input.trim(),
        isInternal: internalOnly,
      }),
    onSuccess: async () => {
      setInput('')
      setFlash(internalOnly ? 'Внутренняя заметка сохранена' : 'Сообщение отправлено клиенту')
      await qc.invalidateQueries({ queryKey: ['analyst', 'comments', applicationId] })
      await qc.invalidateQueries({ queryKey: ['analyst', 'card', applicationId] })
    },
    onError: () => setFlash('Не удалось отправить сообщение'),
  })

  function sendAi() {
    const t = input.trim()
    if (!t) return
    const reply = buildLocalAiReply(t, c.company, card.checksSummary.passed, card.checksSummary.warnings)
    setAiMsgs((m) => [...m, { role: 'user', text: t }, { role: 'ai', text: reply }])
    setInput('')
  }

  function send() {
    if (!input.trim()) return
    if (mode === 'ai') {
      sendAi()
      return
    }
    postM.mutate()
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={{ ...tileSx, minHeight: 460, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          <ChatRoundedIcon sx={{ color: '#EF3124', fontSize: 22 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', flex: 1 }}>
            {mode === 'client' ? 'Переписка с клиентом' : 'AI Copilot'}
          </Typography>
          <Button
            size="small"
            variant={mode === 'client' ? 'contained' : 'outlined'}
            sx={mode === 'client' ? primaryBtn : outlineBtn}
            onClick={() => setMode('client')}
          >
            Клиент
          </Button>
          <Button
            size="small"
            variant={mode === 'ai' ? 'contained' : 'outlined'}
            sx={mode === 'ai' ? primaryBtn : outlineBtn}
            onClick={() => setMode('ai')}
          >
            AI
          </Button>
        </Stack>

        {flash && (
          <Alert
            severity={flash.startsWith('Не') ? 'error' : 'success'}
            sx={{ mb: 1.25 }}
            onClose={() => setFlash(null)}
          >
            {flash}
          </Alert>
        )}

        <Typography sx={{ fontSize: 12.5, color: '#8A96A3', mb: 1.5 }}>
          {mode === 'client'
            ? 'Публичные сообщения видит предприниматель в карточке заявки. Внутренние — только банк.'
            : 'Локальный помощник по контексту заявки (не решение банка).'}
        </Typography>

        <Stack
          spacing={1.25}
          sx={{
            flex: 1,
            mb: 2,
            maxHeight: 360,
            overflowY: 'auto',
            pr: 0.5,
          }}
        >
          {mode === 'client' && commentsQ.isLoading && (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
              <CircularProgress size={26} sx={{ color: '#EF3124' }} />
            </Box>
          )}
          {mode === 'client' && !commentsQ.isLoading && thread.length === 0 && (
            <Typography sx={{ fontSize: 13.5, color: '#8A96A3' }}>
              Пока нет сообщений. Напишите клиенту — например, уточните цель кредита или запросите
              пояснение по выписке.
            </Typography>
          )}
          {mode === 'client' &&
            thread.map((m) => {
              const mine = m.authorId === user?.id || m.authorRole.toUpperCase().includes('ANALYST')
              return (
                <Box
                  key={m.id}
                  sx={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '92%',
                    px: 1.5,
                    py: 1.15,
                    borderRadius: 2,
                    bgcolor: m.isInternal
                      ? 'rgba(11,31,53,0.06)'
                      : mine
                        ? 'rgba(239,49,36,0.08)'
                        : '#F7F8FA',
                    border: m.isInternal ? '1px dashed rgba(11,31,53,0.18)' : 'none',
                    color: '#0B1F35',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#8A96A3', mb: 0.35 }}>
                    {m.authorName || m.authorRole}
                    {m.isInternal ? ' · внутр.' : ''} · {formatHistoryAt(m.createdAt)}
                  </Typography>
                  {m.text}
                </Box>
              )
            })}
          {mode === 'ai' &&
            aiMsgs.map((m, i) => (
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
          <div ref={bottomRef} />
        </Stack>

        {mode === 'client' && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={internalOnly}
                onChange={(_, v) => setInternalOnly(v)}
                color="default"
              />
            }
            label={
              <Typography sx={{ fontSize: 12.5, color: '#5A6B7D' }}>
                Только внутренняя заметка (клиент не увидит)
              </Typography>
            }
            sx={{ mb: 1, ml: 0 }}
          />
        )}

        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder={
              mode === 'client'
                ? internalOnly
                  ? 'Внутренняя заметка…'
                  : 'Ответ клиенту…'
                : 'Спросить AI по заявке…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
          />
          <Button
            variant="contained"
            sx={primaryBtn}
            onClick={send}
            disabled={!input.trim() || postM.isPending}
          >
            {postM.isPending ? <CircularProgress size={18} color="inherit" /> : 'Отправить'}
          </Button>
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: '#EF3124' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35' }}>
            Вопросы клиента
          </Typography>
        </Stack>
        {clientQuestions.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#8A96A3', mb: 2 }}>
            Пока клиент ничего не писал — можно инициировать переписку слева.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {clientQuestions.slice(-5).map((q) => (
              <Button
                key={q.id}
                fullWidth
                variant="outlined"
                sx={{ ...outlineBtn, justifyContent: 'flex-start', textAlign: 'left', py: 1.1 }}
                onClick={() => {
                  setMode('client')
                  setInternalOnly(false)
                  setInput(`По вашему вопросу: «${q.text.slice(0, 80)}${q.text.length > 80 ? '…' : ''}» — `)
                }}
              >
                <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.text}
                </Box>
              </Button>
            ))}
          </Stack>
        )}

        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.25 }}>
          Быстрые ответы
        </Typography>
        <Stack spacing={1}>
          {[
            'Нужна выписка за 6 месяцев в PDF — загрузите, пожалуйста, в разделе документов.',
            'По сумме: можем рассмотреть контрпредложение с меньшей суммой при сохранении срока.',
            'Заявка на финальном рассмотрении. Решение направим в кабинет, как только зафиксируем checks.',
          ].map((q) => (
            <Button
              key={q}
              fullWidth
              variant="outlined"
              sx={{ ...outlineBtn, justifyContent: 'flex-start', textAlign: 'left', py: 1.1 }}
              onClick={() => {
                setMode('client')
                setInternalOnly(false)
                setInput(q)
              }}
            >
              {q.slice(0, 72)}…
            </Button>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}

function buildLocalAiReply(
  question: string,
  company: string,
  passed: number,
  warnings: number,
): string {
  const q = question.toLowerCase()
  if (q.includes('документ')) {
    return `По ${company}: проверьте вкладку «Документы» и закройте открытые запросы перед одобрением. При нехватке данных запросите документы у клиента.`
  }
  if (q.includes('решен') || q.includes('одобр') || q.includes('отказ')) {
    return `Решение оформляется на экране «Решение»: одобрить, отклонить, контрпредложение или запросить информацию. Сейчас проверок пройдено ${passed}${warnings ? `, замечаний ${warnings}` : ''}.`
  }
  if (q.includes('риск') || q.includes('политик')) {
    return `Опирайтесь на результаты проверок, финансы и историю заявки. Итоговое решение фиксируйте на экране «Решение».`
  }
  return `Учёл вопрос по заявке ${company}. Чтобы ответить клиенту, переключитесь на вкладку «Клиент».`
}
