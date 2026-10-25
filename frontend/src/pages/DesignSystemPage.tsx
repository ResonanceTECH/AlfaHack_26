import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  AlfaLogo,
  AlfaMark,
  BRAND_FAVICON_SRC,
  BRAND_LOGO_SRC,
} from '@/components/landing/AlfaLogo'
import { Disclaimer } from '@/components/common/Disclaimer'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import { ColorSwatch, CopyCode } from '@/components/design-system/CopyCode'
import { ProductKitDemos } from '@/components/design-system/ProductKitDemos'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import {
  color,
  font,
  iconSize,
  layout,
  motion,
  radius,
  shadow,
  space,
  typographyScale,
} from '@/theme/tokens'

const NAV = [
  { id: 'brand', label: 'Brand' },
  { id: 'colors', label: 'Цвета' },
  { id: 'typography', label: 'Типографика' },
  { id: 'spacing', label: 'Отступы' },
  { id: 'grid', label: 'Сетка' },
  { id: 'radius', label: 'Радиусы' },
  { id: 'shadows', label: 'Тени' },
  { id: 'icons', label: 'Иконки' },
  { id: 'buttons', label: 'Кнопки' },
  { id: 'inputs', label: 'Инпуты' },
  { id: 'chips', label: 'Chips' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'blocks', label: 'Блоки' },
  { id: 'password', label: 'PasswordField' },
  { id: 'toggles', label: 'Toggles' },
  { id: 'credit-card', label: 'Credit card' },
  { id: 'schedule', label: 'Schedule table' },
  { id: 'auth-widgets', label: 'Auth widgets' },
  { id: 'tabs', label: 'Tabs / Accordion' },
  { id: 'avatars', label: 'Avatar / Badge' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'status-colors', label: 'Statuses' },
  { id: 'cta-row', label: 'CTA patterns' },
  { id: 'nav-patterns', label: 'Навигация' },
  { id: 'stepper', label: 'Stepper' },
  { id: 'logo', label: 'Логотип' },
  { id: 'sources', label: 'Файлы репо' },
  { id: 'theme-code', label: 'Theme code' },
] as const

/** Real paths that exist in this repository (keep in sync with src/). */
const REPO_SOURCES: { path: string; role: string }[] = [
  { path: 'public/logo.png', role: 'Марка UI (AlfaLogo / AlfaMark → /logo.png)' },
  { path: 'public/favicon.png', role: 'Favicon вкладки (index.html)' },
  { path: 'public/favicon-source.png', role: 'Исходник марки 1254px' },
  { path: 'src/theme/index.ts', role: 'MUI createTheme' },
  { path: 'src/theme/tokens.ts', role: 'Токены для копипаста в продукт' },
  { path: 'src/components/landing/AlfaLogo.tsx', role: 'AlfaLogo, AlfaMark, BRAND_*_SRC' },
  { path: 'src/components/common/PageHeader.tsx', role: 'PageHeader' },
  { path: 'src/components/common/StatBlock.tsx', role: 'StatBlock' },
  { path: 'src/components/common/EmptyState.tsx', role: 'EmptyState' },
  { path: 'src/components/common/Disclaimer.tsx', role: 'Disclaimer' },
  { path: 'src/components/auth/AuthShell.tsx', role: 'AuthShell, AuthFooterLink' },
  { path: 'src/components/auth/PasswordField.tsx', role: 'PasswordField' },
  { path: 'src/components/auth/LinkExpiryTimer.tsx', role: 'LinkExpiryTimer' },
  { path: 'src/components/onboarding/LegalFormToggle.tsx', role: 'LegalFormToggle' },
  { path: 'src/components/onboarding/OnboardingShell.tsx', role: 'OnboardingShell' },
  { path: 'src/components/onboarding/OnboardingWizardLayout.tsx', role: 'OnboardingWizardLayout' },
  { path: 'src/features/selection/SelectionStepper.tsx', role: 'SelectionStepper' },
  { path: 'src/features/credit/CreditRecommendationCard.tsx', role: 'CreditRecommendationCard' },
  { path: 'src/features/credit/PaymentScheduleTable.tsx', role: 'PaymentScheduleTable' },
  { path: 'src/components/design-system/ProductKitDemos.tsx', role: 'Демо продуктовых компонентов' },
  { path: 'src/layouts/AppLayout.tsx', role: 'Кабинет: drawer 260 / rail 72' },
  { path: 'src/pages/DesignSystemPage.tsx', role: 'Эта страница' },
]

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <Box
      id={id}
      component="section"
      sx={{
        scrollMarginTop: 88,
        py: { xs: 4, md: 5 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="h4"
        sx={{ fontFamily: font.display, fontWeight: 800, letterSpacing: '-0.03em', mb: 0.75 }}
      >
        {title}
      </Typography>
      {lead ? (
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
          {lead}
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }} />
      )}
      {children}
    </Box>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        mb: 1.5,
        mt: 3,
      }}
    >
      {children}
    </Typography>
  )
}

/** Mirror of `src/theme/index.ts` — update both together. */
const THEME_SNIPPET = `import { createTheme } from '@mui/material/styles'

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
})`

const TOKENS_IMPORT = `import { color, font, space, radius, shadow, layout } from '@/theme/tokens'

// примеры
Box sx={{ bgcolor: color.primary.main, p: 2, borderRadius: \`\${radius.button}px\` }}
Typography sx={{ fontFamily: font.display, fontWeight: 800 }}
Box sx={{ boxShadow: shadow.paper1 }}`

export function DesignSystemPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'clip',
        bgcolor: 'background.default',
        boxSizing: 'border-box',
      }}
    >
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ maxWidth: '100%' }}>
        <Toolbar
          sx={{
            gap: { xs: 1, sm: 2 },
            minHeight: { xs: 64, md: 68 },
            px: { xs: 1.5, sm: 2 },
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackIcon />}
            color="inherit"
            sx={{ fontWeight: 600, flexShrink: 0, px: { xs: 1, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              На лендинг
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Назад
            </Box>
          </Button>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: { xs: 15, sm: 18 },
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Линия решения · Design System
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        disableGutters={false}
        sx={{
          py: { xs: 2, md: 3 },
          pb: 10,
          px: { xs: 1.5, sm: 2, md: 3 },
          width: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '200px minmax(0, 1fr)' },
            gap: { xs: 2, md: 4 },
            alignItems: 'start',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          <Box
            component="nav"
            sx={{
              position: { md: 'sticky' },
              top: 88,
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              gap: 0.35,
              maxHeight: 'calc(100vh - 112px)',
              overflow: 'auto',
              pr: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 1 }}>
              СОДЕРЖАНИЕ
            </Typography>
            {NAV.map((item) => (
              <MuiLink
                key={item.id}
                href={`#${item.id}`}
                underline="hover"
                sx={{
                  fontSize: 13,
                  color: 'text.secondary',
                  py: 0.35,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {item.label}
              </MuiLink>
            ))}
          </Box>

          <Box sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <Paper
              elevation={1}
              sx={{ p: { xs: 2, sm: 2.5, md: 3.5 }, mb: 2, borderRadius: 2, maxWidth: '100%', overflow: 'hidden' }}
            >
              <Typography
                variant="h3"
                sx={{ fontFamily: font.display, fontWeight: 800, letterSpacing: '-0.03em', mb: 1 }}
              >
                UI Kit
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
                Живая спецификация визуальной системы «Линия решения». Все значения совпадают с{' '}
                <code>src/theme/index.ts</code> и переиспользуемыми токенами{' '}
                <code>src/theme/tokens.ts</code>. Кнопка «копировать» — у каждого сниппета.
              </Typography>
              <Stack spacing={1} sx={{ maxWidth: '100%' }}>
                <CopyCode code="import { color, font, radius, shadow } from '@/theme/tokens'" compact />
                <CopyCode code="/design-system" compact label="route" />
              </Stack>
            </Paper>

            {/* ── Brand ── */}
            <Section
              id="brand"
              title="Brand"
              lead={`Марка = портфель из public/logo.png (константа BRAND_LOGO_SRC = "${BRAND_LOGO_SRC}"). Вкладка: public/favicon.png. Не путать с устаревшим SVG/буквой «A».`}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: color.background.hero,
                    color: '#fff',
                    minHeight: 140,
                  }}
                >
                  <AlfaLogo to={false} />
                  <Typography sx={{ mt: 2, fontSize: 13, color: color.text.onDark62 }}>
                    AlfaLogo · dark (landing header/footer)
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: '#fff',
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: 140,
                  }}
                >
                  <AlfaLogo ink to={false} />
                  <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary' }}>
                    AlfaLogo ink · auth / onboarding
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: '#fff',
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AlfaMark size={36} />
                    <AlfaMark size={28} />
                    <Box
                      component="img"
                      src={BRAND_LOGO_SRC}
                      alt=""
                      sx={{ width: 48, height: 48, borderRadius: 1.25, objectFit: 'cover' }}
                    />
                  </Stack>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    AlfaMark / raw {BRAND_LOGO_SRC} · AppLayout sidebar
                  </Typography>
                </Box>
              </Box>
              <Stack spacing={1} sx={{ mt: 2, mb: 2, maxWidth: '100%' }}>
                <CopyCode compact label="UI mark" code={BRAND_LOGO_SRC} />
                <CopyCode compact label="favicon" code={BRAND_FAVICON_SRC} />
                <CopyCode
                  compact
                  label="import"
                  code={`import { AlfaLogo, AlfaMark, BRAND_LOGO_SRC } from '@/components/landing/AlfaLogo'`}
                />
              </Stack>
              <CopyCode
                label="AlfaLogo.tsx — как в репо"
                code={`import {
  AlfaLogo,
  AlfaMark,
  BRAND_LOGO_SRC,   // '${BRAND_LOGO_SRC}' → public/logo.png
  BRAND_FAVICON_SRC // '${BRAND_FAVICON_SRC}' → public/favicon.png
} from '@/components/landing/AlfaLogo'

<AlfaLogo />              // mark + white wordmark (hero / footer)
<AlfaLogo ink />          // mark + ink wordmark (светлый фон)
<AlfaLogo ink compact />  // 28px mark + wordmark
<AlfaLogo markOnly />     // только картинка, без текста
<AlfaMark size={32} />    // сайдбар кабинета (AppLayout)`}
              />
            </Section>

            {/* ── Colors ── */}
            <Section
              id="colors"
              title="Цвета"
              lead="Палитра MUI + ad-hoc soft fills. Копируй hex / rgba напрямую."
            >
              <Sub>Primary</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <ColorSwatch name="primary.main" value={color.primary.main} />
                <ColorSwatch name="primary.dark" value={color.primary.dark} />
                <ColorSwatch name="primary.light" value={color.primary.light} />
                <ColorSwatch name="gradient CTA" value={color.primary.gradient} preview={color.primary.gradient} />
                <ColorSwatch name="soft 4%" value={color.primary.soft04} />
                <ColorSwatch name="soft 6%" value={color.primary.soft06} />
                <ColorSwatch name="soft 8%" value={color.primary.soft08} />
                <ColorSwatch name="soft 20%" value={color.primary.soft20} />
              </Box>

              <Sub>Secondary / ink</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <ColorSwatch name="secondary.main" value={color.secondary.main} />
                <ColorSwatch name="secondary.dark" value={color.secondary.dark} />
                <ColorSwatch name="secondary.light" value={color.secondary.light} />
                <ColorSwatch name="ink soft 3%" value={color.secondary.soft03} />
                <ColorSwatch name="ink soft 8%" value={color.secondary.soft08} />
              </Box>

              <Sub>Backgrounds</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <ColorSwatch name="bg.default" value={color.background.default} />
                <ColorSwatch name="bg.paper" value={color.background.paper} />
                <ColorSwatch name="auth page" value={color.background.authPage} />
                <ColorSwatch name="hero / footer" value={color.background.hero} />
                <ColorSwatch name="inactive track" value={color.background.inactive} />
              </Box>

              <Sub>Text</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <ColorSwatch name="text.primary" value={color.text.primary} />
                <ColorSwatch name="text.secondary" value={color.text.secondary} />
                <ColorSwatch name="text.muted" value={color.text.muted} />
                <ColorSwatch name="inactive label" value={color.text.inactive} />
              </Box>

              <Sub>Semantic</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <ColorSwatch name="success" value={color.semantic.success} />
                <ColorSwatch name="warning" value={color.semantic.warning} />
                <ColorSwatch name="error" value={color.semantic.error} />
                <ColorSwatch name="divider" value={color.semantic.divider} />
              </Box>

              <Box sx={{ mt: 3 }}>
                <CopyCode
                  label="sx через токены"
                  code={`import { color } from '@/theme/tokens'

sx={{
  color: color.text.primary,
  bgcolor: color.background.paper,
  border: '1px solid',
  borderColor: color.semantic.divider,
  background: color.primary.gradient, // CTA
}}`}
                />
              </Box>
            </Section>

            {/* ── Typography ── */}
            <Section
              id="typography"
              title="Типографика"
              lead="Display = Manrope. UI = IBM Plex Sans. Buttons без caps."
            >
              <Stack spacing={2} sx={{ mb: 3 }}>
                {(
                  [
                    ['h1', 'Кредит на развитие малого бизнеса'],
                    ['h2', 'Подбор продукта под цель'],
                    ['h3', 'Финансовый профиль'],
                    ['h4', 'Заголовок страницы кабинета'],
                    ['h5', 'KPI / карточка'],
                    ['h6', 'Секция / список'],
                  ] as const
                ).map(([variant, sample]) => (
                  <Box key={variant}>
                    <Typography
                      variant={variant}
                      sx={{ mb: 0.5 }}
                    >
                      {sample}
                    </Typography>
                    <CopyCode
                      compact
                      label={variant}
                      code={`<Typography variant="${variant}">…</Typography>`}
                    />
                  </Box>
                ))}
                <Box>
                  <Typography variant="body1" sx={{ mb: 0.5 }}>
                    Body1 — основной текст интерфейса. IBM Plex Sans, комфортная плотность для форм и
                    кабинета.
                  </Typography>
                  <CopyCode compact code={`<Typography variant="body1">…</Typography>`} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Body2 — вторичный / denser: таблицы, хинты, описания в карточках.
                  </Typography>
                  <CopyCode compact code={`<Typography variant="body2" color="text.secondary">…</Typography>`} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Caption — лейблы StatBlock, overline-метаданные.
                  </Typography>
                  <CopyCode compact code={`<Typography variant="caption" color="text.secondary">…</Typography>`} />
                </Box>
              </Stack>

              <Sub>Font stacks</Sub>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <CopyCode compact label="display" code={font.display} />
                <CopyCode compact label="ui" code={font.ui} />
                <CopyCode compact label="mono" code={font.mono} />
              </Stack>

              <Sub>Google Fonts (index.html)</Sub>
              <CopyCode
                label="link"
                code={`<link
  href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>`}
              />

              <Sub>Scale object (tokens)</Sub>
              <CopyCode
                label="typographyScale"
                code={`export const typographyScale = ${JSON.stringify(typographyScale, null, 2)}`}
              />
            </Section>

            {/* ── Spacing ── */}
            <Section
              id="spacing"
              title="Отступы"
              lead={`MUI spacing unit = ${space.unit}px. theme.spacing(n) → n×8.`}
            >
              <Stack spacing={1.25} sx={{ mb: 3, maxWidth: '100%' }}>
                {([0.5, 1, 1.5, 2, 3, 4, 5, 6, 8] as const).map((n) => {
                  const px = space.px[n]
                  return (
                    <Box
                      key={n}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '88px minmax(0, 1fr)' },
                        gap: 1,
                        alignItems: 'center',
                        maxWidth: '100%',
                      }}
                    >
                      <Typography sx={{ fontFamily: font.mono, fontSize: 12, flexShrink: 0 }}>
                        {n} → {px}px
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }}>
                        <Box
                          sx={{
                            height: 28,
                            width: `min(${px}px, 40%)`,
                            maxWidth: px,
                            minWidth: 4,
                            bgcolor: color.primary.main,
                            borderRadius: 0.5,
                            opacity: 0.85,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <CopyCode compact code={`sx={{ p: ${n} }} // ${px}px`} />
                        </Box>
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
              <CopyCode
                label="частые паттерны"
                code={`// PageHeader margin-bottom
sx={{ mb: 3 }}           // 24px

// Card / StatBlock padding
sx={{ p: 2 }}            // 16px

// Auth form padding
sx={{ p: { xs: 3.25, sm: 5 } }}

// Stack gaps
<Stack spacing={2}>…</Stack>
<Stack spacing={1.5}>…</Stack>`}
              />
            </Section>

            {/* ── Grid ── */}
            <Section
              id="grid"
              title="Сетка и layout"
              lead="Container maxWidth=lg (~1200). Кабинет: drawer 260 / rail 72. Auth card max 980."
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(4, minmax(0, 1fr))',
                    md: 'repeat(12, minmax(0, 1fr))',
                  },
                  gap: 1,
                  mb: 2,
                  maxWidth: '100%',
                }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      gridColumn: { md: 'span 1' },
                      display: {
                        xs: i < 2 ? 'grid' : 'none',
                        sm: i < 4 ? 'grid' : 'none',
                        md: 'grid',
                      },
                      height: 40,
                      bgcolor: i % 2 ? color.primary.soft08 : color.secondary.soft06,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      placeItems: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    {i + 1}
                  </Box>
                ))}
              </Box>

              <Sub>Breakpoints</Sub>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {Object.entries(layout.breakpoints).map(([k, v]) => (
                  <CopyCode key={k} compact label={k} code={`${v}px`} />
                ))}
              </Stack>

              <CopyCode
                label="layout snippets"
                code={`import { layout } from '@/theme/tokens'

// Landing / kit
<Container maxWidth="lg">…</Container>

// 2-col split (auth, hero)
sx={{
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: { xs: 2, md: 4 },
}}

// 12-col product grid
sx={{
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
  gap: 2,
}}

// Cabinet
drawerWidth: ${layout.drawerWidth}
railWidth: ${layout.railWidth}
authCardMaxWidth: ${layout.authCardMaxWidth}
contentMaxReadable: ${layout.contentMaxReadable}  // subtitles`}
              />
            </Section>

            {/* ── Radius ── */}
            <Section id="radius" title="Радиусы" lead="Тема shape.borderRadius=10. Кнопки отдельно 8.">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 2,
                  mb: 2,
                }}
              >
                {(
                  [
                    ['button', radius.button],
                    ['theme', radius.theme],
                    ['card', radius.card],
                    ['auth', radius.authCard],
                  ] as const
                ).map(([name, r]) => (
                  <Box
                    key={name}
                    sx={{
                      height: 88,
                      bgcolor: color.primary.soft06,
                      border: '1.5px solid',
                      borderColor: color.primary.soft20,
                      borderRadius: `${r}px`,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {name} · {r}px
                  </Box>
                ))}
              </Box>
              <CopyCode
                code={`import { radius } from '@/theme/tokens'

sx={{ borderRadius: 2 }}                    // MUI * theme (= ~10–16)
sx={{ borderRadius: \`\${radius.button}px\` }} // 8 — buttons
sx={{ borderRadius: \`\${radius.authCard}px\` }} // 24 — auth card
sx={{ borderRadius: '50%' }}                // stepper dots / avatars

// Landing sheet top corners
borderTopLeftRadius: { xs: 28, sm: 40, md: 56 }`}
              />
            </Section>

            {/* ── Shadows ── */}
            <Section id="shadows" title="Тени" lead="Мягкий slate, без neon glow.">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 3,
                  mb: 2,
                }}
              >
                <Paper
                  elevation={1}
                  sx={{ p: 3, borderRadius: 2, textAlign: 'center', fontWeight: 700 }}
                >
                  Paper elevation1
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    {shadow.paper1}
                  </Typography>
                </Paper>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: '#fff',
                    boxShadow: shadow.authCard,
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  Auth card
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    {shadow.authCard}
                  </Typography>
                </Box>
              </Box>
              <CopyCode
                code={`import { shadow } from '@/theme/tokens'

<Paper elevation={1}>…</Paper>
sx={{ boxShadow: shadow.paper1 }}
sx={{ boxShadow: shadow.authCard }}

// AppBar — без тени, glass
sx={{
  backgroundColor: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(${motion.glassBlur})',
  borderBottom: '1px solid rgba(11,31,53,0.08)',
  boxShadow: 'none',
}}`}
              />
            </Section>

            {/* ── Icons ── */}
            <Section
              id="icons"
              title="Иконки"
              lead={`Пакет @mui/icons-material. Nav ≈ ${iconSize.nav}px, inline ${iconSize.inline}–${iconSize.md}px. Предпочитай Rounded / Outlined.`}
            >
              <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                {(
                  [
                    ['Home', <HomeRoundedIcon key="h" sx={{ fontSize: iconSize.nav }} />],
                    ['AI', <AutoAwesomeRoundedIcon key="a" sx={{ fontSize: iconSize.nav }} />],
                    ['Apps', <AssignmentRoundedIcon key="ap" sx={{ fontSize: iconSize.nav }} />],
                    ['Search', <SearchRoundedIcon key="s" sx={{ fontSize: iconSize.nav }} />],
                    ['Add', <AddRoundedIcon key="ad" sx={{ fontSize: iconSize.nav }} />],
                    ['Copy', <ContentCopyRoundedIcon key="c" sx={{ fontSize: iconSize.nav }} />],
                    ['Check', <CheckCircleRoundedIcon key="ch" sx={{ fontSize: iconSize.nav, color: 'success.main' }} />],
                    ['Warn', <WarningAmberRoundedIcon key="w" sx={{ fontSize: iconSize.nav, color: 'warning.main' }} />],
                    ['Error', <ErrorOutlineRoundedIcon key="e" sx={{ fontSize: iconSize.nav, color: 'error.main' }} />],
                    ['Done', <CheckRoundedIcon key="d" sx={{ fontSize: iconSize.nav, color: 'success.main' }} />],
                  ] as const
                ).map(([label, icon]) => (
                  <Box
                    key={label}
                    sx={{
                      width: 88,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      textAlign: 'center',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box sx={{ color: 'text.primary', mb: 0.75 }}>{icon}</Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{label}</Typography>
                  </Box>
                ))}
              </Stack>
              <CopyCode
                code={`import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import { iconSize } from '@/theme/tokens'

const iconSx = { fontSize: iconSize.nav } // 22 — sidebar

<HomeRoundedIcon sx={iconSx} />
<WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#D97706' }} />
<CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#1B8A5A' }} />
// Brand accent on feature icons:
sx={{ fontSize: 20, color: '#EF3124' }}`}
              />
            </Section>

            {/* ── Buttons ── */}
            <Section
              id="buttons"
              title="Кнопки"
              lead="disableElevation. Primary = gradient. textTransform: none. На этом экране кнопки только демо — без переходов."
            >
              <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }} alignItems="center">
                <Button type="button" variant="contained">
                  Contained primary
                </Button>
                <Button type="button" variant="contained" color="secondary">
                  Secondary
                </Button>
                <Button type="button" variant="outlined">
                  Outlined
                </Button>
                <Button type="button" variant="text">
                  Text
                </Button>
                <Button type="button" variant="contained" size="small">
                  Small
                </Button>
                <Button type="button" variant="contained" size="large">
                  Large
                </Button>
                <Button type="button" variant="contained" disabled>
                  Disabled
                </Button>
                <Button type="button" variant="contained" startIcon={<AddRoundedIcon />}>
                  With icon
                </Button>
                <Button type="button" variant="outlined" color="inherit">
                  Inherit outline
                </Button>
              </Stack>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: color.background.hero,
                  mb: 2,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Button type="button" variant="contained" size="large">
                  Оформить заявку
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  sx={{
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.35)',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                  }}
                >
                  Как это работает
                </Button>
              </Box>
              <CopyCode
                code={`import { Button } from '@mui/material'

// Демо / локальный клик
<Button type="button" variant="contained">Сохранить</Button>
<Button type="button" variant="outlined">Отмена</Button>

// В продукте — навигация отдельно:
// <Button component={RouterLink} to="/login" variant="contained">Оформить заявку</Button>

// Theme already sets:
// borderRadius: 8, paddingInline: 18, paddingBlock: 9
// containedPrimary gradient #EF3124 → #D4251A`}
              />
            </Section>

            {/* ── Inputs ── */}
            <Section id="inputs" title="Инпуты и формы" lead="MUI TextField. PasswordField — show/hide + max length.">
              <Stack spacing={2} sx={{ maxWidth: 420, mb: 2 }}>
                <TextField label="Email" placeholder="name@company.ru" fullWidth />
                <TextField label="С суммой" defaultValue="1 500 000" fullWidth helperText="В рублях" />
                <TextField label="Ошибка" error helperText="Обязательное поле" fullWidth />
                <TextField label="Disabled" disabled fullWidth defaultValue="—" />
              </Stack>
              <CopyCode
                code={`import { TextField } from '@mui/material'
import { PasswordField } from '@/components/auth/PasswordField'

<TextField label="Email" fullWidth value={email} onChange={…} />
<TextField label="Сумма" error helperText="Обязательное поле" fullWidth />

<PasswordField
  label="Пароль"
  value={password}
  onChange={setPassword}
  showStrengthHint
  fullWidth
/>`}
              />
            </Section>

            {/* ── Chips ── */}
            <Section id="chips" title="Chips" lead="fontWeight 600 из темы.">
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Chip label="Оборотный" size="small" />
                <Chip label="В сравнении" size="small" color="primary" />
                <Chip label="Одобрено" size="small" color="success" />
                <Chip label="Риск" size="small" color="warning" />
                <Chip label="Отклонено" size="small" color="error" />
                <Chip label="Черновик" variant="outlined" size="small" />
              </Stack>
              <CopyCode
                code={`<Chip size="small" label={productTypeLabels[type]} />
<Chip size="small" color="primary" label="В сравнении" />
<Chip size="small" color="success" label="Одобрено" />`}
              />
            </Section>

            {/* ── Feedback ── */}
            <Section id="feedback" title="Feedback" lead="Alert, progress, disclaimer.">
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Alert severity="info">Информация о статусе заявки.</Alert>
                <Alert severity="success">Выписка успешно разобрана.</Alert>
                <Alert severity="warning">Недостаточно данных за 6 месяцев.</Alert>
                <Alert severity="error">Неверный email или пароль.</Alert>
                <Disclaimer />
                <LinearProgress variant="determinate" value={72} sx={{ height: 6, borderRadius: 3 }} />
              </Stack>
              <CopyCode
                code={`import { Alert, LinearProgress } from '@mui/material'
import { Disclaimer } from '@/components/common/Disclaimer'

<Alert severity="info">…</Alert>
<Alert severity="warning" variant="outlined">…</Alert>
<Disclaimer />
<Disclaimer dense />

<LinearProgress
  variant="determinate"
  value={matchScore * 100}
  sx={{ height: 6, borderRadius: 3 }}
/>`}
              />
            </Section>

            {/* ── Blocks ── */}
            <Section
              id="blocks"
              title="Блоки / композиты"
              lead="Готовые продуктовые куски: PageHeader, StatBlock, EmptyState."
            >
              <Sub>PageHeader</Sub>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', mb: 2, borderRadius: 2 }}>
                <PageHeader
                  title="Компания"
                  subtitle="Реквизиты и контакты активного юрлица"
                  crumbs={[{ label: 'Кабинет' }, { label: 'Компания' }]}
                  actions={
                    <Button type="button" variant="contained" size="small">
                      Изменить
                    </Button>
                  }
                />
              </Paper>
              <CopyCode
                code={`import { PageHeader } from '@/components/common/PageHeader'

<PageHeader
  title="Компания"
  subtitle="Реквизиты и контакты"
  crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'Компания' }]}
  actions={<Button variant="contained">Изменить</Button>}
/>`}
              />

              <Sub>StatBlock</Sub>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <StatBlock label="Выручка" value="12,4 млн ₽" hint="за 12 мес." />
                <StatBlock label="Match" value="87" hint="из 100" accent />
                <StatBlock label="Платёж" value="184 000 ₽" hint="в месяц" />
              </Box>
              <CopyCode
                code={`import { StatBlock } from '@/components/common/StatBlock'

<StatBlock label="Выручка" value="12,4 млн ₽" hint="за 12 мес." />
<StatBlock label="Match" value="87" accent />`}
              />

              <Sub>EmptyState</Sub>
              <Box sx={{ mb: 2 }}>
                <EmptyState
                  title="Пока нет заявок"
                  description="Соберите подбор и отправьте первую демо-заявку."
                  actionLabel="К подбору"
                  onAction={() => undefined}
                />
              </Box>
              <CopyCode
                code={`import { EmptyState } from '@/components/common/EmptyState'

<EmptyState
  title="Пока нет заявок"
  description="Соберите подбор и отправьте первую демо-заявку."
  actionLabel="К подбору"
  actionTo="/app/recommendations"
/>`}
              />
            </Section>

            {/* ── Nav patterns ── */}
            <Section
              id="nav-patterns"
              title="Навигация"
              lead="Паттерн пункта сайдбара кабинета (не полный AppLayout)."
            >
              <Paper elevation={1} sx={{ p: 1, width: '100%', maxWidth: 260, mb: 2, borderRadius: 2 }}>
                <Typography sx={{ px: 1.5, py: 1, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                  БИЗНЕС
                </Typography>
                {(
                  [
                    [true, 'Главная', <HomeRoundedIcon key="1" sx={{ fontSize: 22 }} />],
                    [false, 'AI-консультант', <AutoAwesomeRoundedIcon key="2" sx={{ fontSize: 22 }} />],
                    [false, 'Мои заявки', <AssignmentRoundedIcon key="3" sx={{ fontSize: 22 }} />],
                  ] as const
                ).map(([active, label, icon]) => (
                  <Box
                    key={label}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 1.1,
                      borderRadius: 1.5,
                      mx: 0.5,
                      mb: 0.35,
                      bgcolor: active ? color.primary.soft06 : 'transparent',
                      color: active ? color.primary.main : color.text.primary,
                      fontWeight: active ? 700 : 600,
                      fontSize: 14,
                    }}
                  >
                    {icon}
                    {label}
                  </Box>
                ))}
              </Paper>
              <CopyCode
                code={`const iconSx = { fontSize: 22 }

// Active row
sx={{
  bgcolor: 'rgba(239,49,36,0.06)',
  color: 'primary.main',
  fontWeight: 700,
  borderRadius: 1.5,
}}

// Layout widths
DRAWER_WIDTH = 260
RAIL_WIDTH = 72`}
              />
            </Section>

            <ProductKitDemos />

            {/* ── Stepper ── */}
            <Section id="stepper" title="SelectionStepper" lead="Мастер подбора: 5 шагов.">
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.25, sm: 2 },
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 2,
                  borderRadius: 2,
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
              >
                <SelectionStepper active={2} />
              </Paper>
              <CopyCode
                code={`import { SelectionStepper } from '@/features/selection/SelectionStepper'

<SelectionStepper active={1 | 2 | 3 | 4 | 5} />

// Colors:
// done    → #1B8A5A + check
// current → #EF3124
// todo    → #E8EBEE / #9AA5B1`}
              />
            </Section>

            {/* ── Logo ── */}
            <Section
              id="logo"
              title="Логотип / марка"
              lead={`Файл марки: frontend/public/logo.png → URL ${BRAND_LOGO_SRC}. Favicon: frontend/public/favicon.png → ${BRAND_FAVICON_SRC} (см. index.html).`}
            >
              <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap alignItems="center" sx={{ mb: 2 }}>
                <AlfaLogo ink to={false} />
                <AlfaLogo ink compact to={false} />
                <AlfaMark size={40} />
                <Box
                  component="img"
                  src={BRAND_LOGO_SRC}
                  alt="logo.png"
                  sx={{ width: 64, height: 64, borderRadius: 2, objectFit: 'cover', border: '1px solid', borderColor: 'divider' }}
                />
                <Box
                  component="img"
                  src={BRAND_FAVICON_SRC}
                  alt="favicon.png"
                  sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover', border: '1px solid', borderColor: 'divider' }}
                />
              </Stack>
              <CopyCode
                label="реальные пути"
                code={`// src/components/landing/AlfaLogo.tsx
export const BRAND_LOGO_SRC = '${BRAND_LOGO_SRC}'      // ← public/logo.png (256px)
export const BRAND_FAVICON_SRC = '${BRAND_FAVICON_SRC}' // ← public/favicon.png (64px)

// index.html
<link rel="icon" type="image/png" href="${BRAND_FAVICON_SRC}" />

// Использование
import { AlfaLogo, AlfaMark, BRAND_LOGO_SRC } from '@/components/landing/AlfaLogo'
<AlfaMark size={32} />
<img src={BRAND_LOGO_SRC} width={32} height={32} alt="" />`}
              />
            </Section>

            {/* ── Sources ── */}
            <Section
              id="sources"
              title="Файлы репозитория"
              lead="Карта путей, которые реально лежат в frontend/. Сниппеты выше импортируют только эти модули."
            >
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                {REPO_SOURCES.map((row, i) => (
                  <Box
                    key={row.path}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
                      gap: 1,
                      px: { xs: 1.25, sm: 2 },
                      py: 1.25,
                      borderTop: i === 0 ? 'none' : '1px solid',
                      borderColor: 'divider',
                      alignItems: 'start',
                      minWidth: 0,
                    }}
                  >
                    <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
                      <CopyCode compact code={row.path} />
                    </Box>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                      {row.role}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: 2 }}>
                <CopyCode
                  label="feature cards (тоже в репо)"
                  code={`import { CreditRecommendationCard } from '@/features/credit/CreditRecommendationCard'
import { PaymentScheduleTable } from '@/features/credit/PaymentScheduleTable'
import { LegalFormToggle } from '@/components/onboarding/LegalFormToggle'
import { AuthShell, AuthFooterLink } from '@/components/auth/AuthShell'`}
                />
              </Box>
            </Section>

            {/* ── Theme code ── */}
            <Section
              id="theme-code"
              title="Theme & tokens — полный код"
              lead="Сниппет ниже = содержимое src/theme/index.ts один-в-один. Токены — src/theme/tokens.ts."
            >
              <Sub>Import tokens</Sub>
              <CopyCode label="tokens usage" code={TOKENS_IMPORT} />
              <Sub>createTheme</Sub>
              <CopyCode label="theme/index.ts" code={THEME_SNIPPET} />
              <Sub>Page chrome</Sub>
              <CopyCode
                label="фон кабинета"
                code={`// CssBaseline body (уже в теме)
backgroundImage:
  'radial-gradient(1200px 600px at 100% -10%, rgba(239,49,36,0.08), transparent 55%), radial-gradient(900px 500px at -10% 20%, rgba(11,31,53,0.06), transparent 50%)',
backgroundAttachment: 'fixed',

// Auth page
sx={{ minHeight: '100vh', bgcolor: '#ECEFF3' }}

// Landing hero / footer
sx={{ bgcolor: '#1A1A1A', color: '#fff' }}`}
              />
            </Section>

            <Box sx={{ pt: 4, pb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Источник: <code>src/theme/tokens.ts</code>, <code>src/theme/index.ts</code>, компоненты в{' '}
                <code>src/components/*</code>. Документ-дубль:{' '}
                <code>frontend/docs/design-system.md</code>.
              </Typography>
              <Button component={RouterLink} to="/" sx={{ mt: 2 }}>
                ← Вернуться на лендинг
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
