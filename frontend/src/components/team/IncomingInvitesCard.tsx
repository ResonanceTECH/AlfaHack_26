import { Box, Button, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { acceptInvite, listMyInvites, type CompanyInvite } from '@/api/team'
import { ROLE_LABEL } from '@/features/team/store'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
  }
  if (err instanceof Error) return err.message
  return fallback
}

type Props = {
  onAccepted?: (companyId?: string) => void
  sx?: object
}

export function IncomingInvitesCard({ onAccepted, sx }: Props) {
  const qc = useQueryClient()
  const myInvitesQ = useQuery({
    queryKey: ['team', 'invites', 'mine'],
    queryFn: listMyInvites,
  })
  const invites = myInvitesQ.data ?? []

  const acceptM = useMutation({
    mutationFn: (code: string) => acceptInvite(code),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['team'] })
      await qc.invalidateQueries({ queryKey: ['companies'] })
      onAccepted?.(res.companyId)
    },
  })

  if (myInvitesQ.isLoading || invites.length === 0) return null

  return (
    <Box sx={{ ...tileSx, ...sx }}>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: 16,
          color: '#0B1F35',
          mb: 0.5,
        }}
      >
        Вас пригласили
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#7A8795', mb: 1.75, lineHeight: 1.45 }}>
        Примите приглашение, чтобы войти в команду компании.
      </Typography>
      {acceptM.isError && (
        <Typography sx={{ color: '#C41E14', fontSize: 13, fontWeight: 600, mb: 1.25 }}>
          {apiError(acceptM.error, 'Не удалось принять приглашение')}
        </Typography>
      )}
      <Stack spacing={1.25}>
        {invites.map((inv: CompanyInvite) => (
          <Stack
            key={inv.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'rgba(239,49,36,0.04)',
              border: '1px solid rgba(239,49,36,0.12)',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                {inv.companyName || 'Компания'}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25 }}>
                Роль: {ROLE_LABEL[inv.role]}
                {inv.invitedByName ? ` · от ${inv.invitedByName}` : ''}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              disabled={!inv.code || acceptM.isPending}
              onClick={() => inv.code && acceptM.mutate(inv.code)}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 'none',
                px: 2,
                whiteSpace: 'nowrap',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {acceptM.isPending ? 'Принимаю…' : 'Принять'}
            </Button>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
