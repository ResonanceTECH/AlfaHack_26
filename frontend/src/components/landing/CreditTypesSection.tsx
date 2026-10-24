import { Box, Container, Stack, Typography } from '@mui/material'
import { useState } from 'react'

type ProductGroup = 'short' | 'long'

type ProductCard = {
  id: string
  title: string
  blurb: string
  points: string[]
}

const PRODUCTS: Record<ProductGroup, ProductCard[]> = {
  short: [
    {
      id: 'working_capital',
      title: 'Оборотный кредит',
      blurb: 'Закупка товара, кассовый разрыв, сезон — деньги на операционку.',
      points: ['Одна сумма или траншами', 'Срок до 36 мес.', 'Подбор по выписке и цели'],
    },
    {
      id: 'overdraft',
      title: 'Овердрафт',
      blurb: 'Лимит на счёте: закрываете кассовые ямы без отдельной заявки каждый раз.',
      points: ['Возобновляемый лимит', 'Проценты за факт использования', 'Быстрый вход в кабинете'],
    },
    {
      id: 'credit_line',
      title: 'Кредитная линия',
      blurb: 'Гибкий лимит под закупки и контракты — берёте частями по мере нужды.',
      points: ['Транши по лимиту', 'Контроль в календаре платежей', 'Сравнение с овердрафтом'],
    },
  ],
  long: [
    {
      id: 'investment',
      title: 'Инвестиционный кредит',
      blurb: 'Точка, оборудование, расширение производства — длинный горизонт и ROI.',
      points: ['Срок до 10 лет', 'Сценарии окупаемости', 'Чеклист документов и залога'],
    },
    {
      id: 'equipment',
      title: 'Под оборудование',
      blurb: 'Цель «покупка оборудования» в кабинете сразу тянет инвестиционный трек.',
      points: ['Связка цель → продукт', 'График и нагрузка на cash flow', 'Готовность заявки'],
    },
    {
      id: 'new_point',
      title: 'Под открытие точки',
      blurb: 'Аренда, ремонт, персонал — Scenario Lab покажет, потянет ли бизнес платёж.',
      points: ['Модель выручки точки', 'Сравнение продуктов', 'Заявка менеджеру'],
    },
  ],
}

export function CreditTypesSection() {
  const [group, setGroup] = useState<ProductGroup>('short')
  const [activeId, setActiveId] = useState(PRODUCTS.short[0].id)

  function switchGroup(next: ProductGroup) {
    setGroup(next)
    setActiveId(PRODUCTS[next][0].id)
  }

  const list = PRODUCTS[group]
  const active = list.find((p) => p.id === activeId) ?? list[0]

  return (
    <Box id="products" sx={{ bgcolor: '#fff', pt: { xs: 4, md: 6 }, pb: { xs: 6, md: 9 } }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
          justifyContent="space-between"
          spacing={3}
          sx={{ mb: 3 }}
        >
          <Typography
            component="h2"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 28, md: 40 },
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              color: '#0B1F35',
              maxWidth: 520,
            }}
          >
            Продукты, которые кабинет умеет подбирать
          </Typography>

          <Box
            role="tablist"
            sx={{
              display: 'inline-flex',
              alignSelf: { xs: 'stretch', md: 'flex-start' },
              bgcolor: '#F0F2F5',
              borderRadius: 999,
              p: 0.5,
              flexShrink: 0,
            }}
          >
            {(
              [
                { id: 'short' as const, label: 'Оборот и лимиты' },
                { id: 'long' as const, label: 'Инвестиции и рост' },
              ] as const
            ).map((tab) => {
              const selected = group === tab.id
              return (
                <Box
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  component="button"
                  type="button"
                  onClick={() => switchGroup(tab.id)}
                  sx={{
                    flex: { xs: 1, md: 'none' },
                    border: 0,
                    cursor: 'pointer',
                    borderRadius: 999,
                    px: { xs: 1.5, md: 2.5 },
                    py: 1.25,
                    fontSize: { xs: 13, md: 14 },
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    bgcolor: selected ? '#1A1A1A' : 'transparent',
                    color: selected ? '#fff' : '#5A6B7D',
                    transition: 'background 0.15s, color 0.15s',
                    '&:hover': { color: selected ? '#fff' : '#0B1F35' },
                  }}
                >
                  {tab.label}
                </Box>
              )
            })}
          </Box>
        </Stack>

        <Box
          sx={{
            bgcolor: '#F3F5F8',
            borderRadius: 4,
            p: { xs: 0.75, md: 1 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: `repeat(${list.length}, 1fr)` },
            gap: 0.5,
            mb: 2,
          }}
        >
          {list.map((p) => {
            const selected = active.id === p.id
            return (
              <Box
                key={p.id}
                component="button"
                type="button"
                onClick={() => setActiveId(p.id)}
                sx={{
                  border: 0,
                  cursor: 'pointer',
                  borderRadius: 3,
                  px: 2,
                  py: { xs: 2, md: 2.5 },
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  fontSize: { xs: 14, md: 15 },
                  fontWeight: selected ? 700 : 500,
                  bgcolor: selected ? '#fff' : 'transparent',
                  color: selected ? '#0B1F35' : '#8A96A3',
                  boxShadow: selected ? '0 1px 4px rgba(11,31,53,0.06)' : 'none',
                  transition: 'all 0.15s',
                  '&:hover': { color: '#0B1F35' },
                }}
              >
                {p.title}
              </Box>
            )
          })}
        </Box>

        <Box
          sx={{
            bgcolor: '#F8F9FB',
            borderRadius: 4,
            p: { xs: 3, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
            gap: 3,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: 22,
                color: '#0B1F35',
                mb: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {active.title}
            </Typography>
            <Typography sx={{ color: '#5A6B7D', fontSize: 15, lineHeight: 1.5, mb: 0 }}>
              {active.blurb}
            </Typography>
          </Box>
          <Stack spacing={1.25} component="ul" sx={{ m: 0, pl: 2.5 }}>
            {active.points.map((point) => (
              <Typography
                key={point}
                component="li"
                sx={{ color: '#0B1F35', fontSize: 15, lineHeight: 1.45 }}
              >
                {point}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
