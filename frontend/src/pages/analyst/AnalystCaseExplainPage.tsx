import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchApplicationExplanation, formatAiError, type AiAgentResponse } from '@/api/ai'
import { AiAgentReply } from '@/components/ai/AiAgentReply'
import type { AnalystCaseOutlet } from '@/components/analyst/AnalystCaseShell'
import { tileSx } from '@/features/analyst/styles'

export function AnalystCaseExplainPage() {
  const { applicationId } = useOutletContext<AnalystCaseOutlet>()
  const [data, setData] = useState<AiAgentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!applicationId || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApplicationExplanation(applicationId)
      setData(res)
    } catch (e) {
      setData(null)
      setError(formatAiError(e, 'Не удалось загрузить разбор'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ ...tileSx, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1.25}
          sx={{ mb: 1 }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0B1F35' }}>
            Объяснимость решения
          </Typography>
          <Button
            variant="contained"
            color="primary"
            disabled={loading || !applicationId}
            onClick={() => void load()}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, boxShadow: 'none' }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : data ? 'Обновить' : 'Загрузить разбор'}
          </Button>
        </Stack>
        <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.55, maxWidth: 720 }}>
          Backend сам учитывает роль аналитика и возвращает подробный разбор. Роль в запросе не
          передаём. Числа из прозы не восстанавливаем — readiness_score ≠ кредитный скор.
        </Typography>
      </Box>

      <Box sx={tileSx}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        {data ? (
          <AiAgentReply data={data} />
        ) : (
          !loading && (
            <Typography sx={{ fontSize: 13.5, color: '#7A8795' }}>
              Нажмите «Загрузить разбор», чтобы получить объяснение по этой заявке.
            </Typography>
          )
        )}
      </Box>
    </Box>
  )
}
