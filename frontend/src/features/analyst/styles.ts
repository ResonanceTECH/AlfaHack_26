export const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

export const outlineBtn = {
  borderRadius: 2,
  borderColor: 'rgba(11,31,53,0.14)',
  color: '#0B1F35',
  fontWeight: 600,
  textTransform: 'none' as const,
  bgcolor: '#fff',
  '&:hover': { bgcolor: '#fff', borderColor: 'rgba(11,31,53,0.28)' },
}

export const primaryBtn = {
  borderRadius: 2,
  fontWeight: 700,
  textTransform: 'none' as const,
  bgcolor: '#EF3124',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#D62B1F', boxShadow: 'none' },
}

export const statusPill = {
  display: 'inline-flex',
  alignItems: 'center',
  px: 1,
  py: 0.35,
  borderRadius: 1.25,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
  lineHeight: 1.2,
} as const
