import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AnalystCase } from '@/features/analyst/demoData'
import { outlineBtn, primaryBtn, tileSx } from '@/features/analyst/styles'
import { formatMoney } from '@/utils/format'

export function AnalystCaseDecisionPage() {
  const { caseData: c } = useOutletContext<{ caseData: AnalystCase }>()
  const [decision, setDecision] = useState('approve_conditional')
  const [comment, setComment] = useState(
    'Предварительное одобрение при замене справки об оборотах. Лимит и ставка по базовому продукту.',
  )
  const [amount, setAmount] = useState(String(c.amount))
  const [term, setTerm] = useState(String(c.termMonths))
  const [saved, setSaved] = useState(false)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35', mb: 2 }}>
          Решение по заявке
        </Typography>
        {saved && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
            Решение сохранено (демо) · статус → DECISION_PENDING
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            select
            label="Тип решения"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            <MenuItem value="approve">Одобрить</MenuItem>
            <MenuItem value="approve_conditional">Одобрить с условием</MenuItem>
            <MenuItem value="counteroffer">Контрпредложение</MenuItem>
            <MenuItem value="reject">Отклонить</MenuItem>
            <MenuItem value="escalate">Эскалация риск-аналитику</MenuItem>
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Сумма, ₽"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Срок, мес."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
          <TextField
            label="Комментарий / обоснование"
            multiline
            minRows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" sx={outlineBtn}>
              Сохранить черновик
            </Button>
            <Button variant="contained" sx={primaryBtn} onClick={() => setSaved(true)}>
              Отправить решение
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={tileSx}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0B1F35', mb: 1.5 }}>
          Параметры заявки
        </Typography>
        <Stack spacing={1.25}>
          {[
            ['ID', c.id],
            ['Компания', c.company],
            ['Продукт', c.product],
            ['Запрос', `${formatMoney(c.amount)} · ${c.termMonths} мес.`],
            ['Политика', 'CP-2026.10'],
            ['RBAC', 'ANALYST · write decision'],
          ].map(([k, v]) => (
            <Stack key={k} direction="row" justifyContent="space-between" spacing={2}>
              <Typography sx={{ fontSize: 13, color: '#8A96A3' }}>{k}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: '#0B1F35', textAlign: 'right' }}>
                {v}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
