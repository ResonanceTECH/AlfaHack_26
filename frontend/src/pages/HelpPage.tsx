import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

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

const CATEGORIES: Category[] = [
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

type Faq = { id: string; q: string; a: string; tags: string[] }

const FAQ: Faq[] = [
  {
    id: 'f1',
    q: 'Что значит «предварительное решение»?',
    a: 'Банк оценил данные компании и предложил ориентировочные условия. Финальные параметры фиксируются в договоре после проверки документов и подписания.',
    tags: ['заявка', 'статусы', 'решение'],
  },
  {
    id: 'f2',
    q: 'Почему банк предложил сумму меньше запрошенной?',
    a: 'Сумма зависит от выручки, долговой нагрузки и цели кредита. Можно уточнить условия у менеджера или подать заявку на другой продукт.',
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

const DOCS = [
  { id: 'd1', title: 'Тарифы и комиссии' },
  { id: 'd2', title: 'Политика обработки данных' },
  { id: 'd3', title: 'Инструкция по выписке из 1С' },
]

export function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [expanded, setExpanded] = useState<string | false>('f1')
  const [category, setCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    return FAQ.filter((item) => {
      if (category === 'apps' && !item.tags.some((t) => ['заявка', 'статусы', 'решение', 'сумма'].includes(t)))
        return false
      if (category === 'docs' && !item.tags.includes('документы')) return false
      if (category === 'pay' && !item.tags.some((t) => ['платежи', 'график'].includes(t))) return false
      if (category === 'sec' && !item.tags.some((t) => ['безопасность', 'компания'].includes(t)))
        return false
      if (!q) return true
      return (
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      )
    })
  }, [applied, category])

  function runSearch() {
    const q = query.trim().toLowerCase()
    setApplied(query)
    setCategory(null)
    const first = q
      ? FAQ.find((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      : FAQ[0]
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
          Ответы про кредиты, документы и сроки рассмотрения
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            fullWidth
            placeholder="Например: какие документы нужны для заявки?"
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

      {/* Categories */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 2.5,
        }}
      >
        {CATEGORIES.map((c) => {
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
        {/* FAQ */}
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
                  Ничего не найдено — попробуйте другой запрос или напишите менеджеру.
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
                    border: open
                      ? '1.5px solid #EF3124'
                      : '1px solid rgba(11,31,53,0.06)',
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

        {/* Sidebar */}
        <Stack spacing={2}>
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
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: '#EF3124',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                ИА
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0B1F35', lineHeight: 1.25 }}>
                  Иванова А.С.
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.25 }}>
                  Ваш менеджер · отвечает за 1 час
                </Typography>
              </Box>
            </Stack>
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
              Документы и тарифы
            </Typography>
            <Stack spacing={0}>
              {DOCS.map((d, i) => (
                <Stack
                  key={d.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{
                    py: 1.2,
                    borderBottom: i < DOCS.length - 1 ? '1px solid rgba(11,31,53,0.06)' : 0,
                    cursor: 'pointer',
                    '&:hover .doc-title': { color: '#EF3124' },
                  }}
                  onClick={() => undefined}
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
