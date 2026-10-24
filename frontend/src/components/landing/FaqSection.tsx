import AddRoundedIcon from '@mui/icons-material/AddRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Typography,
} from '@mui/material'
import { useState } from 'react'

const FAQ = [
  {
    q: 'Какие компании могут подать заявку?',
    a: 'ИП и ООО из сегмента малого бизнеса с расчётным счётом и понятной целью финансирования.',
  },
  {
    q: 'Какие документы понадобятся?',
    a: 'Список зависит от продукта и суммы. В кабинете — чеклист под ваш профиль: выписка, отчётность и данные по обеспечению при необходимости.',
  },
  {
    q: 'Сколько занимает подбор продукта?',
    a: 'После указания цели и бюджета shortlist и сравнение появляются за минуты. Дальше — чеклист документов и передача менеджеру.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | false>(false)

  return (
    <Box id="faq" sx={{ bgcolor: '#F7F8FA', pt: { xs: 5, md: 7 }, pb: { xs: 5, md: 7 } }}>
      <Container maxWidth="lg">
        <Typography
          component="h2"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 28, md: 40 },
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: '#0B1F35',
            mb: { xs: 3, md: 4 },
          }}
        >
          Частые вопросы
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {FAQ.map((item, i) => {
            const expanded = open === i
            return (
              <Accordion
                key={item.q}
                expanded={expanded}
                onChange={(_, next) => setOpen(next ? i : false)}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: '#fff',
                  borderRadius: '14px !important',
                  border: '1px solid rgba(11,31,53,0.08)',
                  '&::before': { display: 'none' },
                  overflow: 'hidden',
                }}
              >
                <AccordionSummary
                  expandIcon={
                    expanded ? (
                      <RemoveRoundedIcon sx={{ color: '#0B1F35' }} />
                    ) : (
                      <AddRoundedIcon sx={{ color: '#0B1F35' }} />
                    )
                  }
                  sx={{
                    px: { xs: 2, md: 2.5 },
                    py: 0.5,
                    minHeight: 64,
                    '& .MuiAccordionSummary-content': { my: 1.5 },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 600,
                      fontSize: { xs: 15, md: 16 },
                      color: '#0B1F35',
                      letterSpacing: '-0.01em',
                      pr: 1,
                    }}
                  >
                    {item.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 2, md: 2.5 }, pt: 0, pb: 2.5 }}>
                  <Typography sx={{ color: '#5A6B7D', fontSize: 14, lineHeight: 1.55, maxWidth: 720 }}>
                    {item.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )
          })}
        </Box>
      </Container>
    </Box>
  )
}
