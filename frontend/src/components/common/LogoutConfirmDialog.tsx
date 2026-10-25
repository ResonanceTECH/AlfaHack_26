import { Button, Dialog, Stack, Typography } from '@mui/material'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LogoutConfirmDialog({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          px: { xs: 2.5, sm: 3.25 },
          py: { xs: 2.5, sm: 3 },
          textAlign: 'center',
          boxShadow: '0 16px 48px rgba(11,31,53,0.18)',
        },
      }}
    >
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: 20,
          color: '#0B1F35',
          letterSpacing: '-0.02em',
          mb: 0.75,
        }}
      >
        Выйти из аккаунта?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7A8795', lineHeight: 1.5, mb: 2.5 }}>
        Вы точно хотите выйти? Сессия на этом устройстве будет завершена.
      </Typography>
      <Stack direction="row" spacing={1.25}>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={onClose}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', py: 1.05 }}
        >
          Остаться
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onConfirm}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            py: 1.05,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          Выйти
        </Button>
      </Stack>
    </Dialog>
  )
}
