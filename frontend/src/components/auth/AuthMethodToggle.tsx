import { Box, ButtonBase } from '@mui/material'

export type AuthMethod = 'phone' | 'email'

export function AuthMethodToggle({
  value,
  onChange,
}: {
  value: AuthMethod
  onChange: (v: AuthMethod) => void
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0.5,
        p: 0.5,
        mb: 2.5,
        borderRadius: 2,
        bgcolor: '#F0F2F5',
      }}
    >
      {(
        [
          { id: 'phone' as const, label: 'По телефону' },
          { id: 'email' as const, label: 'По почте' },
        ] as const
      ).map((opt) => {
        const active = value === opt.id
        return (
          <ButtonBase
            key={opt.id}
            onClick={() => onChange(opt.id)}
            sx={{
              py: 1.1,
              px: 1,
              borderRadius: 1.5,
              fontSize: 14,
              fontWeight: 600,
              color: active ? 'text.primary' : 'text.secondary',
              bgcolor: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(11,31,53,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
