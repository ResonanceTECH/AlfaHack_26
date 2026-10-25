import {
  Box,
  Button,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import {
  goalTitle,
  type BudgetLine,
  type SelectionDraft,
} from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const RATE = 17.3
const TERM_PRESETS = [12, 18, 24, 36, 48]
const SEASON = [
  { m: 'Май', v: 1.1 },
  { m: 'Июн', v: 1.2 },
  { m: 'Июл', v: 1.25 },
  { m: 'Авг', v: 1.3 },
  { m: 'Сен', v: 1.55 },
  { m: 'Окт', v: 1.7 },
]

export function SelectionBudgetPage() {
  const navigate = useNavigate()
  const { companyId, financials } = useAppStore()
  const [draft, setDraft] = useState<SelectionDraft>(() => loadSelectionDraft(companyId))

  useEffect(() => {
    setDraft(loadSelectionDraft(companyId))
  }, [companyId])

  useEffect(() => {
    saveSelectionDraft(draft, companyId)
  }, [draft, companyId])

  const linesTotal = useMemo(
    () => draft.lines.reduce((s, l) => s + (l.amount || 0), 0),
    [draft.lines],
  )
  const matches = Math.abs(linesTotal - draft.amount) < 1

  const payment = useMemo(
    () => Math.round(annuityPayment(draft.amount, RATE, draft.termMonths)),
    [draft.amount, draft.termMonths],
  )
  const totalPay = payment * draft.termMonths
  const overpay = totalPay - draft.amount
  const revShare = financials.avgMonthlyRevenue
    ? Math.round((payment / financials.avgMonthlyRevenue) * 100)
    : 16

  function patch(p: Partial<SelectionDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  function updateLine(id: string, patchLine: Partial<BudgetLine>) {
    patch({
      lines: draft.lines.map((l) => (l.id === id ? { ...l, ...patchLine } : l)),
    })
  }

  function addLine() {
    patch({
      lines: [
        ...draft.lines,
        { id: crypto.randomUUID(), title: 'Новая статья', amount: 0, period: '—' },
      ],
    })
  }

  function removeLine(id: string) {
    if (draft.lines.length <= 1) return
    patch({ lines: draft.lines.filter((l) => l.id !== id) })
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        Цель и AI-консультант{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Бюджет цели
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Бюджет цели
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            {goalTitle(draft.goalKey)} · распределите сумму по статьям
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/app/recommendations')}>
            Назад
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/recommendations/results')}
          >
            К подбору
          </Button>
        </Stack>
      </Stack>

      <SelectionStepper active={2} />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.45fr) minmax(280px, 0.9fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ ...tileSx, overflow: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                }}
              >
                Статьи расходов
              </Typography>
              <Button
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={addLine}
                sx={{ color: '#EF3124', fontWeight: 700, textTransform: 'none' }}
              >
                Статья
              </Button>
            </Stack>

            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <Box component="thead">
                <Box component="tr">
                  {['Статья', 'Сумма, ₽', 'Доля', 'Срок затрат', ''].map((h) => (
                    <Box
                      component="th"
                      key={h}
                      sx={{
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#9AA5B1',
                        pb: 1,
                        pr: 1,
                        borderBottom: '1px solid rgba(11,31,53,0.08)',
                      }}
                    >
                      {h}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {draft.lines.map((line) => {
                  const share =
                    draft.amount > 0 ? Math.round((line.amount / draft.amount) * 100) : 0
                  return (
                    <Box
                      component="tr"
                      key={line.id}
                      sx={{
                        '& td': {
                          py: 1.1,
                          pr: 1,
                          borderBottom: '1px solid rgba(11,31,53,0.06)',
                          verticalAlign: 'middle',
                        },
                      }}
                    >
                      <Box component="td" sx={{ minWidth: 160 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={line.title}
                          onChange={(e) => updateLine(line.id, { title: e.target.value })}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& input': { fontSize: 13.5, fontWeight: 650 } }}
                        />
                      </Box>
                      <Box component="td" sx={{ width: 130 }}>
                        <TextField
                          size="small"
                          value={line.amount ? line.amount.toLocaleString('ru-RU') : ''}
                          onChange={(e) =>
                            updateLine(line.id, {
                              amount: Number(e.target.value.replace(/\D/g, '')) || 0,
                            })
                          }
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& input': { fontSize: 13.5, fontWeight: 700 } }}
                        />
                      </Box>
                      <Box component="td" sx={{ width: 100 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 999,
                              bgcolor: '#E8EBEE',
                              overflow: 'hidden',
                              minWidth: 40,
                            }}
                          >
                            <Box
                              sx={{
                                width: `${Math.min(100, share)}%`,
                                height: '100%',
                                bgcolor: '#EF3124',
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, width: 28 }}>
                            {share}%
                          </Typography>
                        </Stack>
                      </Box>
                      <Box component="td" sx={{ width: 90 }}>
                        <TextField
                          size="small"
                          value={line.period}
                          onChange={(e) => updateLine(line.id, { period: e.target.value })}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& input': { fontSize: 13, color: '#5A6B7D' } }}
                        />
                      </Box>
                      <Box component="td" sx={{ width: 36 }}>
                        <IconButton size="small" onClick={() => removeLine(line.id)}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: '#9AA5B1' }} />
                        </IconButton>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 1.75, pt: 1.5, borderTop: '1px solid rgba(11,31,53,0.08)' }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#0B1F35' }}>
                Итого {formatMoney(linesTotal)}
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: matches ? '#1B8A5A' : '#EF3124',
                }}
              >
                {matches ? 'Совпадает с запросом' : `Разница ${formatMoney(linesTotal - draft.amount)}`}
              </Typography>
            </Stack>
          </Box>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 2,
              }}
            >
              Параметры расчёта
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#9AA5B1', mb: 0.5 }}>Сумма</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0B1F35', mb: 0.5 }}>
              {formatMoney(draft.amount)}
            </Typography>
            <Slider
              value={draft.amount}
              min={500_000}
              max={30_000_000}
              step={100_000}
              onChange={(_, v) => patch({ amount: v as number })}
              sx={{
                color: '#EF3124',
                mb: 2.5,
                '& .MuiSlider-rail': { bgcolor: '#E8EBEE' },
              }}
            />
            <Typography sx={{ fontSize: 13, color: '#9AA5B1', mb: 0.5 }}>Срок</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0B1F35', mb: 0.5 }}>
              {draft.termMonths} мес
            </Typography>
            <Slider
              value={draft.termMonths}
              min={6}
              max={60}
              step={1}
              onChange={(_, v) => patch({ termMonths: v as number })}
              sx={{
                color: '#EF3124',
                mb: 1.5,
                '& .MuiSlider-rail': { bgcolor: '#E8EBEE' },
              }}
            />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {TERM_PRESETS.map((t) => (
                <Button
                  key={t}
                  size="small"
                  variant={draft.termMonths === t ? 'contained' : 'outlined'}
                  color={draft.termMonths === t ? 'secondary' : 'inherit'}
                  onClick={() => patch({ termMonths: t })}
                  sx={{
                    minWidth: 48,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: 'rgba(11,31,53,0.14)',
                    bgcolor: draft.termMonths === t ? undefined : '#fff',
                    color: draft.termMonths === t ? undefined : '#0B1F35',
                  }}
                >
                  {t}
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', fontWeight: 600, mb: 0.5 }}>
              Оценка платежа
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: 26,
                fontWeight: 800,
                color: '#0B1F35',
                letterSpacing: '-0.03em',
              }}
            >
              ≈ {formatMoney(payment)}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#7A8795', mb: 2 }}>
              в месяц · {draft.termMonths} мес · от {RATE.toLocaleString('ru-RU')}% годовых
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.5,
              }}
            >
              {[
                ['Всего выплат', `≈ ${(totalPay / 1_000_000).toFixed(2)} млн ₽`],
                ['Переплата', `≈ ${Math.round(overpay / 1000)} тыс ₽`],
                ['Доля от выручки', `${revShare}% / мес`],
                ['Ставка', 'ориентировочно'],
              ].map(([k, v]) => (
                <Box key={k}>
                  <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>{k}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                    {v}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Stack
            direction="row"
            spacing={1.15}
            alignItems="flex-start"
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              bgcolor: '#FFF6EB',
              border: '1px solid rgba(196,106,18,0.18)',
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.1 }} />
            <Typography sx={{ fontSize: 12.5, color: '#8A5A28', lineHeight: 1.45 }}>
              Расчёт ориентировочный, не оферта банка. Итоговые условия — после проверки.
            </Typography>
          </Stack>

          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 1,
              }}
            >
              Сезонность выручки
            </Typography>
            <Box sx={{ width: '100%', height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={SEASON} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="m" tick={{ fill: '#9AA5B1', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(1)}×`, 'Индекс']}
                    contentStyle={{ borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                    {SEASON.map((s) => (
                      <Cell
                        key={s.m}
                        fill={s.m === 'Сен' || s.m === 'Окт' ? '#EF3124' : '#C5CCD3'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.5, lineHeight: 1.4 }}>
              Окт–дек — пик спроса, сырьё нужно запасать заранее.
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
