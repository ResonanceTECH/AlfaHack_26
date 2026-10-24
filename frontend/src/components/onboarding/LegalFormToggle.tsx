import { Box, ButtonBase, Typography } from '@mui/material'
import type { LegalForm } from '@/types'

export function LegalFormToggle({
  value,
  onChange,
}: {
  value: LegalForm
  onChange: (v: LegalForm) => void
}) {
  const options: { id: LegalForm; label: string }[] = [
    { id: 'IP', label: 'ИП' },
    { id: 'OOO', label: 'ООО' },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1.25,
        mb: 2.5,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <ButtonBase
            key={opt.id}
            onClick={() => onChange(opt.id)}
            sx={{
              py: 1.35,
              px: 2,
              borderRadius: 2,
              border: '1.5px solid',
              borderColor: active ? 'primary.main' : 'divider',
              bgcolor: active ? 'rgba(239,49,36,0.04)' : '#fff',
              justifyContent: 'flex-start',
              gap: 1.25,
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: active ? 'primary.main' : 'rgba(11,31,53,0.25)',
              },
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: active ? 'primary.main' : '#C5CCD5',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {active ? (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                  }}
                />
              ) : null}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</Typography>
          </ButtonBase>
        )
      })}
    </Box>
  )
}
