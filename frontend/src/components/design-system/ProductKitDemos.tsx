import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import { useState, type ReactNode } from 'react'
import { AuthFooterLink } from '@/components/auth/AuthShell'
import { LinkExpiryTimer } from '@/components/auth/LinkExpiryTimer'
import { PasswordField } from '@/components/auth/PasswordField'
import { LegalFormToggle } from '@/components/onboarding/LegalFormToggle'
import { ColorSwatch, CopyCode } from '@/components/design-system/CopyCode'
import { CreditRecommendationCard } from '@/features/credit/CreditRecommendationCard'
import { PaymentScheduleTable } from '@/features/credit/PaymentScheduleTable'
import { font } from '@/theme/tokens'
import type { CreditRecommendation, LegalForm, PaymentScheduleResult } from '@/types'

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

const DEMO_REC: CreditRecommendation = {
  productId: 'demo-wc',
  productType: 'working_capital',
  productName: 'Оборотный кредит «Сезон»',
  matchScore: 0.87,
  eligibleByBasicRules: true,
  estimatedMonthlyPayment: 184000,
  estimatedRate: 0.169,
  recommendedAmount: 3500000,
  recommendedTerm: 24,
  reasons: ['Выручка стабильна 12 мес.', 'Нагрузка в допустимом диапазоне', 'Цель совпадает с продуктом'],
  warnings: ['При сумме выше 5 млн может потребоваться залог'],
}

const DEMO_SCHEDULE: PaymentScheduleResult = {
  scheduleType: 'annuity',
  amount: 1_000_000,
  termMonths: 3,
  annualRate: 0.18,
  monthlyPayment: 363_160,
  totalPayment: 1_089_480,
  totalInterest: 89_480,
  totalFees: 0,
  rows: [
    {
      month: 1,
      date: '2026-11-01',
      payment: 363_160,
      principal: 348_160,
      interest: 15_000,
      fees: 0,
      balance: 651_840,
    },
    {
      month: 2,
      date: '2026-12-01',
      payment: 363_160,
      principal: 353_383,
      interest: 9_777,
      fees: 0,
      balance: 298_457,
    },
    {
      month: 3,
      date: '2027-01-01',
      payment: 363_160,
      principal: 298_457,
      interest: 4_477,
      fees: 0,
      balance: 0,
    },
  ],
}

/** Extra product + MUI demos for /design-system */
export function ProductKitDemos() {
  const [password, setPassword] = useState('demo1234')
  const [legal, setLegal] = useState<LegalForm>('IP')
  const [tab, setTab] = useState(0)
  const [selectedCard, setSelectedCard] = useState(false)
  const [check, setCheck] = useState(true)
  const [sw, setSw] = useState(true)

  return (
    <>
      <Section
        id="password"
        title="PasswordField"
        lead="src/components/auth/PasswordField.tsx — show/hide, max length, strength hint."
      >
        <Box sx={{ maxWidth: 420, mb: 2 }}>
          <PasswordField
            label="Пароль"
            value={password}
            onChange={setPassword}
            showStrengthHint
            fullWidth
          />
        </Box>
        <CopyCode
          code={`import { PasswordField } from '@/components/auth/PasswordField'

<PasswordField
  label="Пароль"
  value={password}
  onChange={setPassword}
  showStrengthHint
  fullWidth
/>`}
        />
      </Section>

      <Section
        id="toggles"
        title="Toggles & choice"
        lead="LegalFormToggle (продукт) + MUI Checkbox / Radio / Switch."
      >
        <Sub>LegalFormToggle</Sub>
        <Box sx={{ maxWidth: 420, mb: 2 }}>
          <LegalFormToggle value={legal} onChange={setLegal} />
          <Typography variant="caption" color="text.secondary">
            Выбрано: {legal}
          </Typography>
        </Box>
        <CopyCode
          code={`import { LegalFormToggle } from '@/components/onboarding/LegalFormToggle'

<LegalFormToggle value={legal} onChange={setLegal} />`}
        />

        <Sub>Checkbox · Radio · Switch</Sub>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <FormControlLabel
            control={<Checkbox checked={check} onChange={(_, v) => setCheck(v)} />}
            label="Согласен с условиями демо-заявки"
          />
          <RadioGroup row value={legal === 'IP' ? 'a' : 'b'}>
            <FormControlLabel value="a" control={<Radio />} label="Вариант A" />
            <FormControlLabel value="b" control={<Radio />} label="Вариант B" />
          </RadioGroup>
          <FormControlLabel
            control={<Switch checked={sw} onChange={(_, v) => setSw(v)} color="primary" />}
            label="Только различия в сравнении"
          />
        </Stack>
        <CopyCode
          code={`<FormControlLabel control={<Checkbox />} label="…" />
<RadioGroup row>…</RadioGroup>
<FormControlLabel control={<Switch color="primary" />} label="…" />`}
        />
      </Section>

      <Section
        id="credit-card"
        title="CreditRecommendationCard"
        lead="src/features/credit/CreditRecommendationCard.tsx — карточка продукта в подборе."
      >
        <Box sx={{ maxWidth: 420, mb: 2 }}>
          <CreditRecommendationCard
            item={DEMO_REC}
            selected={selectedCard}
            onToggleCompare={() => setSelectedCard((v) => !v)}
            onCalculate={() => undefined}
            onSelect={() => undefined}
          />
        </Box>
        <CopyCode
          code={`import { CreditRecommendationCard } from '@/features/credit/CreditRecommendationCard'

<CreditRecommendationCard
  item={recommendation}
  selected={inCompare}
  onToggleCompare={…}
  onCalculate={…}
  onSelect={…}
/>`}
        />
      </Section>

      <Section
        id="schedule"
        title="PaymentScheduleTable"
        lead="src/features/credit/PaymentScheduleTable.tsx — график платежей."
      >
        <Box sx={{ mb: 2, maxWidth: '100%', overflowX: 'auto' }}>
          <PaymentScheduleTable result={DEMO_SCHEDULE} />
        </Box>
        <CopyCode
          code={`import { PaymentScheduleTable } from '@/features/credit/PaymentScheduleTable'

<PaymentScheduleTable result={schedule} />`}
        />
      </Section>

      <Section
        id="auth-widgets"
        title="Auth widgets"
        lead="AuthFooterLink и LinkExpiryTimer из auth-слоя."
      >
        <Paper
          elevation={0}
          sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <AuthFooterLink prompt="Вспомнили пароль?" to="/login" label="Войти" />
        </Paper>
        <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <LinkExpiryTimer active={false} />
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
            Таймер жизни magic-link (30:00). На экране forgot/verify — active=true.
          </Typography>
        </Stack>
        <CopyCode
          code={`import { AuthFooterLink } from '@/components/auth/AuthShell'
import { LinkExpiryTimer } from '@/components/auth/LinkExpiryTimer'

<AuthFooterLink prompt="Вспомнили пароль?" to="/login" label="Войти" />
<LinkExpiryTimer active resetKey={resendCount} />`}
        />
      </Section>

      <Section id="tabs" title="Tabs & Accordion" lead="Паттерны секций кабинета / FAQ.">
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
            <Tab label="Профиль" />
            <Tab label="Реквизиты" />
            <Tab label="Счета" />
          </Tabs>
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Контент вкладки #{tab + 1}
            </Typography>
          </Box>
        </Paper>
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography fontWeight={650}>Какие документы нужны?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Список зависит от продукта и суммы — в кабинете чеклист под профиль.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <CopyCode
          code={`<Tabs value={tab} onChange={…}><Tab label="…" /></Tabs>

<Accordion>
  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>…</AccordionSummary>
  <AccordionDetails>…</AccordionDetails>
</Accordion>`}
        />
      </Section>

      <Section id="avatars" title="Avatar · Badge · status chips" lead="Шапка кабинета, уведомления, статусы заявок.">
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800 }}>ИП</Avatar>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>ДК</Avatar>
          <Badge badgeContent={3} color="primary">
            <NotificationsNoneRoundedIcon />
          </Badge>
          <Badge variant="dot" color="error">
            <Avatar sx={{ width: 36, height: 36 }}>М</Avatar>
          </Badge>
          <Chip size="small" color="warning" label="Запрос документов" />
          <Chip size="small" color="success" label="Одобрено" />
        </Stack>
        <CopyCode
          code={`<Avatar sx={{ bgcolor: 'primary.main' }}>ИП</Avatar>
<Badge badgeContent={3} color="primary"><NotificationsNoneRoundedIcon /></Badge>
<Chip size="small" color="warning" label={statusLabels[status]} />`}
        />
      </Section>

      <Section id="skeleton" title="Skeleton / loading" lead="Пока грузятся Query-данные.">
        <Stack spacing={1} sx={{ maxWidth: 360, mb: 2 }}>
          <Skeleton variant="rounded" height={28} width="60%" />
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="text" />
          <Skeleton variant="text" width="80%" />
        </Stack>
        <CopyCode
          code={`{isLoading ? (
  <Skeleton variant="rounded" height={72} />
) : (
  <StatBlock … />
)}`}
        />
      </Section>

      <Section
        id="status-colors"
        title="Status palette"
        lead="Цвета статусов заявок / KPI — как в labels + semantic tokens."
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1.5,
            mb: 2,
          }}
        >
          <ColorSwatch name="draft / muted" value="#9AA5B1" />
          <ColorSwatch name="in_review" value="#5A6B7D" />
          <ColorSwatch name="docs_requested" value="#D97706" />
          <ColorSwatch name="approved / success" value="#1B8A5A" />
          <ColorSwatch name="rejected / error" value="#C41E14" />
          <ColorSwatch name="primary CTA" value="#EF3124" />
        </Box>
        <CopyCode
          code={`import { statusColors, statusLabels } from '@/data/labels'

<Chip size="small" color={statusColors[status]} label={statusLabels[status]} />`}
        />
      </Section>

      <Section id="cta-row" title="CTA patterns" lead="Частые связки кнопок в мастерах и карточках.">
        <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
          <Button variant="contained">Продолжить</Button>
          <Button variant="outlined">Назад</Button>
          <Button variant="text">Пропустить</Button>
          <Button variant="contained" color="secondary">
            Сохранить черновик
          </Button>
          <Button variant="outlined" color="error">
            Отклонить
          </Button>
        </Stack>
        <CopyCode
          code={`<Stack direction="row" spacing={1}>
  <Button variant="outlined">Назад</Button>
  <Button variant="contained">Продолжить</Button>
</Stack>`}
        />
      </Section>
    </>
  )
}
