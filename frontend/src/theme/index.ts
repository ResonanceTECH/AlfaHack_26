import { createTheme } from '@mui/material/styles'

/**
 * Линия решения visual system — red brand signal, cool slate surfaces,
 * Manrope for display, IBM Plex Sans for UI density.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#EF3124',
      dark: '#C41E14',
      light: '#FF5A4F',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0B1F35',
      dark: '#061525',
      light: '#1A3350',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F3F5F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0B1F35',
      secondary: '#5A6B7D',
    },
    success: { main: '#1B8A5A' },
    warning: { main: '#D97706' },
    error: { main: '#C41E14' },
    divider: 'rgba(11, 31, 53, 0.08)',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Manrope", system-ui, sans-serif',
    h1: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontFamily: 'Manrope, sans-serif', fontWeight: 750, letterSpacing: '-0.02em' },
    h3: { fontFamily: 'Manrope, sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: 'Manrope, sans-serif', fontWeight: 700 },
    h5: { fontFamily: 'Manrope, sans-serif', fontWeight: 650 },
    h6: { fontFamily: 'Manrope, sans-serif', fontWeight: 650 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(1200px 600px at 100% -10%, rgba(239,49,36,0.08), transparent 55%), radial-gradient(900px 500px at -10% 20%, rgba(11,31,53,0.06), transparent 50%)',
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 18, paddingBlock: 9 },
        containedPrimary: {
          background: 'linear-gradient(135deg, #EF3124 0%, #D4251A 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #D4251A 0%, #B91C14 100%)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation1: {
          boxShadow: '0 1px 2px rgba(11,31,53,0.04), 0 8px 24px rgba(11,31,53,0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.88)',
          color: '#0B1F35',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(11,31,53,0.08)',
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
})
