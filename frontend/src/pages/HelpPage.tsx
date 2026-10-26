import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isAnalystRole } from '@/features/analyst/roles'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const outlineBtn = {
  borderRadius: 2,
  borderColor: 'rgba(11,31,53,0.14)',
  color: '#0B1F35',
  fontWeight: 600,
  fontSize: 13.5,
  bgcolor: '#fff',
  textTransform: 'none' as const,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
}

type Category = {
  id: string
  title: string
  meta: string
  icon: ReactNode
}

type Faq = { id: string; q: string; a: string; tags: string[] }

const ENT_CATEGORIES: Category[] = [
  {
    id: 'apps',
    title: 'Заявка и статусы',
    meta: '12 статей',
    icon: <DescriptionOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'docs',
    title: 'Документы',
    meta: '9 статей',
    icon: <FolderOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'pay',
    title: 'Платежи и график',
    meta: '8 статей',
    icon: <PaymentsOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'sec',
    title: 'Безопасность',
    meta: '6 ссылок',
    icon: <LockOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
]

const ANALYST_CATEGORIES: Category[] = [
  {
    id: 'queue',
    title: 'Очередь и статусы',
    meta: 'разбор заявок',
    icon: <DescriptionOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'checks',
    title: 'Проверки и документы',
    meta: 'checks · requests',
    icon: <FactCheckOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'decision',
    title: 'Решение',
    meta: 'одобрить / отклонить',
    icon: <TaskAltOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
  {
    id: 'policy',
    title: 'Политика доступа',
    meta: 'роли и видимость',
    icon: <PolicyOutlinedIcon sx={{ fontSize: 22, color: '#EF3124' }} />,
  },
]

const ENT_FAQ: Faq[] = [
  {
    id: 'f1',
    q: 'Что значит «предварительное решение»?',
    a: 'Банк оценил данные компании и предложил ориентировочные условия. Финальные параметры фиксируются в договоре после проверки документов и подписания.',
    tags: ['заявка', 'статусы', 'решение'],
  },
  {
    id: 'f2',
    q: 'Почему банк предложил сумму меньше запрошенной?',
    a: 'Сумма зависит от выручки, долговой нагрузки и цели кредита. Можно уточнить условия в чате с банком или подать заявку на другой продукт.',
    tags: ['заявка', 'сумма'],
  },
  {
    id: 'f3',
    q: 'Какие документы нужны для заявки?',
    a: 'Обычно: паспорт, учредительные документы, выписка по счетам за 6–12 месяцев, налоговая отчётность. Точный список зависит от продукта и суммы.',
    tags: ['документы', 'заявка'],
  },
  {
    id: 'f4',
    q: 'Можно ли погасить кредит досрочно?',
    a: 'Да, полное и частичное досрочное погашение доступно. Комиссия и срок уведомления указаны в договоре и тарифах продукта.',
    tags: ['платежи', 'график'],
  },
  {
    id: 'f5',
    q: 'Как долго действует предложение банка?',
    a: 'Обычно 5–14 календарных дней с даты предварительного решения. Точный срок указан в карточке предложения.',
    tags: ['заявка', 'статусы'],
  },
  {
    id: 'f6',
    q: 'Как изменить данные компании?',
    a: 'Откройте раздел «Компания» и сохраните изменения. Часть полей из реестра (ИНН, ОГРН) доступна только для просмотра.',
    tags: ['компания', 'безопасность'],
  },
]

const ANALYST_FAQ: Faq[] = [
  {
    id: 'a1',
    q: 'Как взять заявку в работу?',
    a: 'Откройте карточку из очереди или «Мои заявки» и нажмите «Взять в работу». Заявка закрепится за вами.',
    tags: ['очередь', 'назначение'],
  },
  {
    id: 'a2',
    q: 'Какие решения можно вынести?',
    a: 'Одобрить (с оффером клиенту), отклонить, предложить контрусловия по сумме/сроку/ставке или запросить дополнительную информацию.',
    tags: ['решение', 'статусы'],
  },
  {
    id: 'a3',
    q: 'Почему нельзя одобрить заявку?',
    a: 'Одобрить можно даже при замечаниях по проверкам или без полного комплекта документов — это демо-поток. После принятия оффера клиентом аналитик отправляет договор на согласование владельцу.',
    tags: ['решение', 'проверки', 'договор'],
  },
  {
    id: 'a4',
    q: 'Как запросить документы у клиента?',
    a: 'Вкладка «Документы» → тип и комментарий → «Запросить». Клиент увидит запрос в карточке заявки и сможет загрузить файл.',
    tags: ['документы', 'очередь'],
  },
  {
    id: 'a5',
    q: 'Где ответить клиенту на вопрос?',
    a: 'Вкладка «Чат с клиентом» в карточке заявки. Публичные сообщения видит предприниматель; внутренние заметки — только банк.',
    tags: ['чат', 'клиент'],
  },
  {
    id: 'a6',
    q: 'Что видит клиент, а что только банк?',
    a: 'Клиенту доступны публичные проверки, офферы и сообщения. Внутренние проверки и служебные комментарии остаются только в кабинете аналитика.',
    tags: ['политика', 'проверки'],
  },
]

const ENT_DOCS = [
  { id: 'd1', title: 'Тарифы и комиссии' },
  { id: 'd2', title: 'Политика обработки данных' },
  { id: 'd3', title: 'Инструкция по выписке из 1С' },
]

const ANALYST_DOCS = [
  { id: 'd1', title: 'Кредитная политика CP-2026.10' },
  { id: 'd2', title: 'Регламент запроса документов' },
  { id: 'd3', title: 'Роли: аналитик и риск' },
]

function matchCategory(item: Faq, category: string | null, analyst: boolean): boolean {
  if (!category) return true
  if (analyst) {
    if (category === 'queue' && !item.tags.some((t) => ['очередь', 'назначение', 'статусы'].includes(t)))
      return false
    if (category === 'checks' && !item.tags.some((t) => ['проверки', 'документы'].includes(t)))
      return false
    if (category === 'decision' && !item.tags.some((t) => ['решение', 'статусы'].includes(t)))
      return false
    if (category === 'policy' && !item.tags.some((t) => ['политика', 'чат', 'клиент'].includes(t)))
      return false
    return true
  }
  if (category === 'apps' && !item.tags.some((t) => ['заявка', 'статусы', 'решение', 'сумма'].includes(t)))
    return false
  if (category === 'docs' && !item.tags.includes('документы')) return false
  if (category === 'pay' && !item.tags.some((t) => ['платежи', 'график'].includes(t))) return false
  if (category === 'sec' && !item.tags.some((t) => ['безопасность', 'компания'].includes(t)))
    return false
  return true
}

export function HelpPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const analyst = isAnalystRole(user?.role)

  const categories = analyst ? ANALYST_CATEGORIES : ENT_CATEGORIES
  const faq = analyst ? ANALYST_FAQ : ENT_FAQ
  const docs = analyst ? ANALYST_DOCS : ENT_DOCS

  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [expanded, setExpanded] = useState<string | false>(analyst ? 'a1' : 'f1')
  const [category, setCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    return faq.filter((item) => {
      if (!matchCategory(item, category, analyst)) return false
      if (!q) return true
      return (
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      )
    })
  }, [applied, category, faq, analyst])

  function runSearch() {
    const q = query.trim().toLowerCase()
    setApplied(query)
    setCategory(null)
    const first = q
      ? faq.find((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      : faq[0]
    setExpanded(first?.id ?? false)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Box sx={{ mb: 2.5 }}>
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
          Помощь и вопросы
        </Typography>
        <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6, mb: 2 }}>
          {analyst
            ? 'Регламент разбора заявок, проверок, решений и переписки с клиентом'
            : 'Ответы про кредиты, документы и сроки рассмотрения'}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            fullWidth
            placeholder={
              analyst
                ? 'Например: как запросить документы у клиента?'
                : 'Например: какие документы нужны для заявки?'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor: '#fff',
                '& fieldset': { borderColor: 'rgba(11,31,53,0.1)' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: '#9AA5B1' }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={runSearch}
            sx={{
              borderRadius: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              py: 1.35,
              boxShadow: 'none',
              flexShrink: 0,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Найти
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 2.5,
        }}
      >
        {categories.map((c) => {
          const active = category === c.id
          return (
            <Box
              key={c.id}
              onClick={() => setCategory(active ? null : c.id)}
              sx={{
                ...tileSx,
                p: 1.75,
                cursor: 'pointer',
                borderColor: active ? 'rgba(239,49,36,0.35)' : 'rgba(11,31,53,0.06)',
                bgcolor: active ? 'rgba(239,49,36,0.03)' : '#fff',
                transition: 'border-color 0.12s, background 0.12s',
                '&:hover': { borderColor: 'rgba(11,31,53,0.16)' },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: 'rgba(239,49,36,0.08)',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 1.25,
                }}
              >
                {c.icon}
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0B1F35', lineHeight: 1.3 }}>
                {c.title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.4 }}>{c.meta}</Typography>
            </Box>
          )
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(280px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.5,
            }}
          >
            Частые вопросы
          </Typography>
          <Stack spacing={1.25}>
            {filtered.length === 0 && (
              <Box sx={tileSx}>
                <Typography sx={{ color: '#9AA5B1', fontSize: 14 }}>
                  {analyst
                    ? 'Ничего не найдено — попробуйте другой запрос или откройте регламент справа.'
                    : 'Ничего не найдено — попробуйте другой запрос или напишите в чат банка.'}
                </Typography>
              </Box>
            )}
            {filtered.map((item) => {
              const open = expanded === item.id
              return (
                <Accordion
                  key={item.id}
                  disableGutters
                  elevation={0}
                  expanded={open}
                  onChange={(_, v) => setExpanded(v ? item.id : false)}
                  sx={{
                    borderRadius: '12px !important',
                    border: open ? '1.5px solid #EF3124' : '1px solid rgba(11,31,53,0.06)',
                    bgcolor: '#fff',
                    boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
                    '&:before': { display: 'none' },
                    overflow: 'hidden',
                  }}
                >
                  <AccordionSummary
                    expandIcon={
                      open ? (
                        <CloseRoundedIcon sx={{ fontSize: 20, color: '#EF3124' }} />
                      ) : (
                        <AddRoundedIcon sx={{ fontSize: 22, color: '#5A6B7D' }} />
                      )
                    }
                    sx={{
                      px: 2,
                      py: 0.35,
                      minHeight: 56,
                      '& .MuiAccordionSummary-content': { my: 1.25 },
                    }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35', pr: 1 }}>
                      {item.q}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                    <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.55 }}>
                      {item.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )
            })}
          </Stack>
        </Box>

        <Stack spacing={2}>
          {analyst ? (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1,
                }}
              >
                Быстрые действия
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#7A8795', mb: 1.75, lineHeight: 1.45 }}>
                Персонального менеджера нет — рабочий контур: очередь, карточка заявки и чат с
                клиентом.
              </Typography>
              <Stack spacing={1.1}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/app/analyst')}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    py: 1.1,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' },
                  }}
                >
                  К очереди заявок
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ChatOutlinedIcon sx={{ fontSize: 18 }} />}
                  sx={{ ...outlineBtn, py: 1.05 }}
                  onClick={() => navigate('/app/analyst/mine')}
                >
                  Мои заявки / чат в карточке
                </Button>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 1.75, lineHeight: 1.45 }}>
                Внутренняя поддержка платформы: helpdesk@alfa.demo
                <br />
                Пн–Пт 9:00–20:00
              </Typography>
            </Box>
          ) : (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.75,
                }}
              >
                Связаться с банком
              </Typography>
              <Stack spacing={1.1}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/app/ai?new=manager')}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    py: 1.1,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' },
                  }}
                >
                  Написать в чат
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ ...outlineBtn, py: 1.05 }}
                  href="tel:88000000000"
                >
                  Заказать звонок
                </Button>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mt: 1.75, lineHeight: 1.45 }}>
                8 800 000-00-00
                <br />
                Пн–Пт 9:00–20:00 · Сб 10:00–16:00
              </Typography>
            </Box>
          )}

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 1.25,
              }}
            >
              {analyst ? 'Регламенты' : 'Документы и тарифы'}
            </Typography>
            <Stack spacing={0}>
              {docs.map((d, i) => (
                <Stack
                  key={d.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{
                    py: 1.2,
                    borderBottom: i < docs.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                    cursor: 'pointer',
                    '&:hover .doc-title': { color: '#EF3124' },
                  }}
                >
                  <PictureAsPdfOutlinedIcon sx={{ fontSize: 20, color: '#EF3124' }} />
                  <Typography
                    className="doc-title"
                    sx={{
                      flex: 1,
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#0B1F35',
                      transition: 'color 0.12s',
                    }}
                  >
                    {d.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9AA5B1' }}>PDF</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
