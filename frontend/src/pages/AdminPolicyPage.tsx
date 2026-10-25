import Grid from '@mui/material/Grid2'
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

type SectionId =
  | 'admission'
  | 'scoring'
  | 'limits'
  | 'rates'
  | 'antifraud'
  | 'counteroffer'
  | 'documents'

type RuleStatus = 'active' | 'changed' | 'new' | 'disabled'

type Rule = {
  id: string
  section: SectionId
  condition: string
  action: string
  priority: number
  status: RuleStatus
  dsl: string
}

const SECTIONS: { id: SectionId; label: string; count: number }[] = [
  { id: 'admission', label: 'Допуск заёмщика', count: 14 },
  { id: 'scoring', label: 'Скоринг', count: 22 },
  { id: 'limits', label: 'Лимиты и DSCR', count: 9 },
  { id: 'rates', label: 'Ставки', count: 12 },
  { id: 'antifraud', label: 'Антифрод', count: 17 },
  { id: 'counteroffer', label: 'Counteroffer', count: 6 },
  { id: 'documents', label: 'Документы', count: 11 },
]

const VERSIONS = [
  { id: 'v13', label: 'v13 · черновик', badge: 'Сейчас', tone: 'now' as const },
  { id: 'v12', label: 'v12 · 14.10', badge: 'Прод', tone: 'prod' as const },
  { id: 'v11', label: 'v11 · 02.10', badge: null, tone: 'old' as const },
  { id: 'v10', label: 'v10 · 18.09', badge: null, tone: 'old' as const },
]

const RULES: Rule[] = [
  {
    id: 'R-101',
    section: 'admission',
    condition: 'business_age_months >= 12',
    action: 'Допуск',
    priority: 10,
    status: 'active',
    dsl: `rule R-101 {
  when business_age_months >= 12
  then admit
  reason "Минимальный возраст бизнеса"
}`,
  },
  {
    id: 'R-130',
    section: 'admission',
    condition: 'tax_debt = false',
    action: 'Допуск',
    priority: 50,
    status: 'active',
    dsl: `rule R-130 {
  when tax_debt = false
  then admit
  reason "Нет налоговой задолженности"
}`,
  },
  {
    id: 'R-212',
    section: 'admission',
    condition: 'dscr(requested) < 1.3',
    action: 'Counteroffer',
    priority: 60,
    status: 'changed',
    dsl: `rule R-212 {
  when dscr(requested_amount, term, rate) < 1.3
  and dscr(offer_amount) >= 1.3
  then counteroffer (max_amount: offer_amount)
  reason "Платёж превышает допустимую нагрузку"
}`,
  },
  {
    id: 'R-215',
    section: 'admission',
    condition: 'avg_balance < 0.1 * payment',
    action: 'Отказ',
    priority: 70,
    status: 'new',
    dsl: `rule R-215 {
  when avg_balance < 0.1 * payment
  then reject
  reason "Недостаточный средний остаток"
}`,
  },
  {
    id: 'R-231',
    section: 'admission',
    condition: 'sector_risk = high',
    action: 'Риск-аналитик',
    priority: 90,
    status: 'disabled',
    dsl: `rule R-231 {
  when sector_risk = high
  then escalate(risk_analyst)
  reason "Высокий отраслевой риск"
}`,
  },
  {
    id: 'R-340',
    section: 'scoring',
    condition: 'score_band in [A, B+]',
    action: 'Допуск',
    priority: 20,
    status: 'active',
    dsl: `rule R-340 {
  when score_band in [A, B+]
  then admit
}`,
  },
  {
    id: 'R-410',
    section: 'limits',
    condition: 'requested_amount > limit_cap',
    action: 'Counteroffer',
    priority: 40,
    status: 'changed',
    dsl: `rule R-410 {
  when requested_amount > limit_cap
  then counteroffer(max_amount: limit_cap)
}`,
  },
]

const statusMeta: Record<RuleStatus, { label: string; bgcolor: string; color: string }> = {
  active: {
    label: 'Активно',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  changed: {
    label: 'Изменено',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  new: {
    label: 'Новое',
    bgcolor: color.primary.soft08,
    color: color.primary.main,
  },
  disabled: {
    label: 'Отключено',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
}

const DIFF = [
  { kind: 'del' as const, text: 'R-212: dscr < 1.2' },
  { kind: 'add' as const, text: 'R-212: dscr < 1.3' },
  { kind: 'add' as const, text: 'R-215: avg_balance < 0.1 * payment' },
  { kind: 'del' as const, text: 'R-198: sector_block (удалено)' },
]

export function AdminPolicyPage() {
  const [section, setSection] = useState<SectionId>('admission')
  const [version, setVersion] = useState('v13')
  const [selectedId, setSelectedId] = useState('R-212')

  const rules = useMemo(() => RULES.filter((r) => r.section === section), [section])
  const selected = useMemo(
    () => rules.find((r) => r.id === selectedId) ?? rules[0] ?? RULES[2]!,
    [rules, selectedId],
  )
  const [dsl, setDsl] = useState(selected.dsl)

  function pickRule(id: string) {
    const r = RULES.find((x) => x.id === id)
    if (!r) return
    setSelectedId(id)
    setDsl(r.dsl)
  }

  function pickSection(id: SectionId) {
    setSection(id)
    const first = RULES.find((r) => r.section === id)
    if (first) {
      setSelectedId(first.id)
      setDsl(first.dsl)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Кредитная политика"
        subtitle="Версия v13 (черновик) · основана на v12 · автор Орлова Е.В."
        actions={
          <>
            <Button
              variant="outlined"
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Сравнить версии
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Проверить
            </Button>
            <Button
              variant="contained"
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Отправить на публикацию
            </Button>
          </>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3, lg: 2.5 }}>
          <Box sx={{ ...tileSx, mb: 2 }}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: color.text.inactive,
                mb: 1,
                px: 0.5,
              }}
            >
              Разделы
            </Typography>
            <List disablePadding>
              {SECTIONS.map((s) => (
                <ListItemButton
                  key={s.id}
                  selected={section === s.id}
                  onClick={() => pickSection(s.id)}
                  sx={{
                    borderRadius: 2,
                    py: 0.75,
                    px: 1.25,
                    mb: 0.25,
                    '&.Mui-selected': {
                      bgcolor: color.primary.soft06,
                      color: color.text.primary,
                      '&:hover': { bgcolor: color.primary.soft08 },
                    },
                  }}
                >
                  <ListItemText
                    primary={s.label}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 650 }}
                  />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: color.text.muted }}>
                    {s.count}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: color.text.inactive,
                mb: 1,
                px: 0.5,
              }}
            >
              Версии
            </Typography>
            <List disablePadding>
              {VERSIONS.map((v) => (
                <ListItemButton
                  key={v.id}
                  selected={version === v.id}
                  onClick={() => setVersion(v.id)}
                  sx={{
                    borderRadius: 2,
                    py: 0.75,
                    px: 1.25,
                    mb: 0.25,
                    '&.Mui-selected': {
                      bgcolor: color.secondary.soft03,
                    },
                  }}
                >
                  <ListItemText
                    primary={v.label}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                  />
                  {v.badge && (
                    <Chip
                      size="small"
                      label={v.badge}
                      sx={{
                        height: 22,
                        fontSize: 10.5,
                        fontWeight: 700,
                        bgcolor:
                          v.tone === 'prod' ? color.secondary.main : color.primary.soft08,
                        color: v.tone === 'prod' ? color.text.onDark : color.primary.main,
                      }}
                    />
                  )}
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5.5, lg: 6 }}>
          <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              {SECTIONS.find((s) => s.id === section)?.label}
            </Typography>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Условие</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Действие</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Приор.
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((r) => {
                  const sm = statusMeta[r.status]
                  return (
                    <TableRow
                      key={r.id}
                      hover
                      selected={r.id === selected.id}
                      onClick={() => pickRule(r.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            fontFamily: font.mono,
                            color: color.text.muted,
                          }}
                        >
                          {r.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontFamily: font.mono,
                            color: color.text.primary,
                            maxWidth: 220,
                          }}
                          noWrap
                        >
                          {r.condition}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.action}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: 13, color: color.text.secondary }}>
                          {r.priority}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={sm.label}
                          sx={{
                            bgcolor: sm.bgcolor,
                            color: sm.color,
                            fontWeight: 700,
                            fontSize: 11,
                            height: 24,
                            borderRadius: `${radius.chip}px`,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: color.text.muted }}>
                        В разделе пока нет правил в демо
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>

          <Box sx={tileSx}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 15,
                  color: color.text.primary,
                }}
              >
                Редактор правила {selected.id}
              </Typography>
              <Chip
                size="small"
                label="DSL v2"
                sx={{
                  height: 22,
                  fontSize: 10.5,
                  fontWeight: 700,
                  bgcolor: color.secondary.soft06,
                  color: color.text.secondary,
                }}
              />
            </Stack>
            <TextField
              multiline
              minRows={8}
              fullWidth
              value={dsl}
              onChange={(e) => setDsl(e.target.value)}
              InputProps={{
                sx: {
                  fontFamily: font.mono,
                  fontSize: 12.5,
                  bgcolor: color.secondary.soft03,
                  borderRadius: 2,
                  '& textarea': { lineHeight: 1.55 },
                },
              }}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 3.5, lg: 3.5 }}>
          <Box sx={{ ...tileSx, mb: 2 }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              Изменения v12 → v13
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {[
                { label: 'Добавлено', value: 2, c: color.semantic.success },
                { label: 'Изменено', value: 3, c: color.semantic.warning },
                { label: 'Удалено', value: 1, c: color.semantic.error },
                { label: 'Продуктов', value: 2, c: color.text.secondary },
              ].map((s) => (
                <Box
                  key={s.label}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: color.secondary.soft03,
                    border: `1px solid ${color.semantic.divider}`,
                    minWidth: 72,
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: color.text.muted, fontWeight: 600 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 750, color: s.c, lineHeight: 1.2 }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Stack
              spacing={0.5}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: '#0B1F35',
                fontFamily: font.mono,
              }}
            >
              {DIFF.map((d) => (
                <Typography
                  key={d.text}
                  sx={{
                    fontSize: 12,
                    fontFamily: font.mono,
                    color: d.kind === 'add' ? '#6EE7B7' : '#FCA5A5',
                    lineHeight: 1.45,
                  }}
                >
                  {d.kind === 'add' ? '+ ' : '− '}
                  {d.text}
                </Typography>
              ))}
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              Проверки и согласование
            </Typography>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: color.semantic.success, mt: 0.1 }} />
                <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                  Синтаксис корректен
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: color.semantic.success, mt: 0.1 }} />
                <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                  Нет конфликтов приоритетов
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <WarningAmberRoundedIcon sx={{ fontSize: 20, color: color.semantic.warning, mt: 0.1 }} />
                <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                  Тесты: 3 кейса изменили результат
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <RadioButtonUncheckedRoundedIcon
                  sx={{ fontSize: 20, color: color.text.inactive, mt: 0.1 }}
                />
                <Typography sx={{ fontSize: 13.5, color: color.text.primary }}>
                  Согласование: 0 из 2
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Grid>

    </Box>
  )
}
