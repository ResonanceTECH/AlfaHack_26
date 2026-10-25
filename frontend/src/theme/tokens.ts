/**
 * Линия решения design tokens — single source for product reuse.
 * Keep in sync with `theme/index.ts` (MUI createTheme).
 */

export const color = {
  primary: {
    main: '#EF3124',
    dark: '#C41E14',
    light: '#FF5A4F',
    contrastText: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #EF3124 0%, #D4251A 100%)',
    gradientHover: 'linear-gradient(135deg, #D4251A 0%, #B91C14 100%)',
    soft04: 'rgba(239,49,36,0.04)',
    soft06: 'rgba(239,49,36,0.06)',
    soft08: 'rgba(239,49,36,0.08)',
    soft20: 'rgba(239,49,36,0.2)',
  },
  secondary: {
    main: '#0B1F35',
    dark: '#061525',
    light: '#1A3350',
    soft03: 'rgba(11,31,53,0.03)',
    soft06: 'rgba(11,31,53,0.06)',
    soft08: 'rgba(11,31,53,0.08)',
    soft25: 'rgba(11,31,53,0.25)',
  },
  background: {
    default: '#F3F5F8',
    paper: '#FFFFFF',
    authPage: '#ECEFF3',
    hero: '#1A1A1A',
    inactive: '#E8EBEE',
  },
  text: {
    primary: '#0B1F35',
    secondary: '#5A6B7D',
    muted: '#8A94A6',
    inactive: '#9AA5B1',
    onDark: '#FFFFFF',
    onDark62: 'rgba(255,255,255,0.62)',
    onDark65: 'rgba(255,255,255,0.65)',
    onDark78: 'rgba(255,255,255,0.78)',
    onDark45: 'rgba(255,255,255,0.45)',
    onDark40: 'rgba(255,255,255,0.4)',
  },
  semantic: {
    success: '#1B8A5A',
    warning: '#D97706',
    error: '#C41E14',
    divider: 'rgba(11, 31, 53, 0.08)',
  },
} as const

export const font = {
  display: 'Manrope, sans-serif',
  ui: '"IBM Plex Sans", "Manrope", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

export const typographyScale = {
  h1: { fontFamily: font.display, fontWeight: 800, letterSpacing: '-0.03em', fontSize: '2.5rem' },
  h2: { fontFamily: font.display, fontWeight: 750, letterSpacing: '-0.02em', fontSize: '2rem' },
  h3: { fontFamily: font.display, fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.75rem' },
  h4: { fontFamily: font.display, fontWeight: 700, fontSize: '1.5rem' },
  h5: { fontFamily: font.display, fontWeight: 650, fontSize: '1.25rem' },
  h6: { fontFamily: font.display, fontWeight: 650, fontSize: '1.125rem' },
  body1: { fontFamily: font.ui, fontWeight: 400, fontSize: '1rem', lineHeight: 1.5 },
  body2: { fontFamily: font.ui, fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.43 },
  caption: { fontFamily: font.ui, fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.4 },
  button: { fontFamily: font.ui, fontWeight: 600, fontSize: '0.875rem', textTransform: 'none' as const },
  overline: {
    fontFamily: font.ui,
    fontWeight: 600,
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
} as const

/** MUI spacing unit = 8px. Keys are theme spacing multipliers. */
export const space = {
  unit: 8,
  /** px helpers */
  px: {
    0: 0,
    0.5: 4,
    1: 8,
    1.5: 12,
    2: 16,
    2.5: 20,
    3: 24,
    3.5: 28,
    4: 32,
    5: 40,
    6: 48,
    8: 64,
    10: 80,
  },
} as const

export const radius = {
  theme: 10,
  button: 8,
  chip: 16,
  pill: 999,
  card: 12,
  authCard: 24,
  landingSheet: { xs: 28, sm: 40, md: 56 },
  mark: 10, // ~1.25 * 8
} as const

export const shadow = {
  paper1: '0 1px 2px rgba(11,31,53,0.04), 0 8px 24px rgba(11,31,53,0.06)',
  authCard: '0 16px 48px rgba(11,31,53,0.14)',
  none: 'none',
} as const

export const layout = {
  containerMaxWidth: 'lg' as const, // MUI lg ≈ 1200px
  containerPx: { xs: 16, sm: 24 },
  drawerWidth: 260,
  railWidth: 72,
  authCardMaxWidth: 980,
  contentMaxReadable: 720,
  gridGaps: { xs: 16, md: 24 },
  breakpoints: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
} as const

export const motion = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  glassBlur: '12px',
} as const

export const iconSize = {
  nav: 22,
  inline: 18,
  md: 20,
  lg: 24,
  xl: 32,
} as const

export const zIndex = {
  appBar: 1100,
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
} as const
