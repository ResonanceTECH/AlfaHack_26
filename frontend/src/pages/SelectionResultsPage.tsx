import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchRecommendations } from '@/api/credit'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import { goalTitle, type SelectionDraft } from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import type { ProductType } from '@/types'
import { productTypeLabels } from '@/data/labels'
import {
  DEMO_PRODUCTS,
  REJECTED_PRODUCTS,
  type DemoProduct,
} from '@/features/selection/demoProducts'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const DEMO = DEMO_PRODUCTS
const REJECTED = REJECTED_PRODUCTS

const TYPE_FILTERS: { key: ProductType | 'leasing'; label: string }[] = [
  { key: 'working_capital', label: 'Оборотный кредит' },
  { key: 'overdraft', label: 'Овердрафт' },
  { key: 'investment', label: 'Инвестиционный' },
  { key: 'leasing', label: 'Лизинг' },
]

export function SelectionResultsPage() {
  const navigate = useNavigate()
  const { companyId, goal, setCompareIds, setSelectedProduct } = useAppStore()
  const [draft, setDraft] = useState<SelectionDraft>(() => loadSelectionDraft(companyId))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'payment' | 'rate' | 'score'>('payment')
  const [rateMax, setRateMax] = useState(21)
  const [types, setTypes] = useState<Record<string, boolean>>({
    working_capital: true,
    overdraft: true,
    investment: true,
    leasing: false,
  })
  const [collateral, setCollateral] = useState({
    none: true,
    guarantee: true,
    property: false,
  })
  const [speed, setSpeed] = useState<'1' | '3'>('1')
  const [filterAmount, setFilterAmount] = useState(draft.amount)
  const [filterTerm, setFilterTerm] = useState(draft.termMonths)

  useEffect(() => {
    const d = loadSelectionDraft(companyId)
    setDraft(d)
    setFilterAmount(d.amount)
    setFilterTerm(d.termMonths)
  }, [companyId])

  useEffect(() => {
    saveSelectionDraft(draft, companyId)
    setCompareIds(draft.compareIds)
  }, [draft, companyId, setCompareIds])

  const recQ = useQuery({
    queryKey: ['recommendations', companyId, goal?.id, draft.amount, draft.termMonths],
    queryFn: () =>
      fetchRecommendations({
        companyId: companyId!,
        businessGoalId: goal?.id,
        amount: draft.amount,
        termMonths: draft.termMonths,
      }),
    enabled: Boolean(companyId && goal),
    retry: false,
  })

  const products: DemoProduct[] = useMemo(() => {
    if (recQ.data?.recommendations?.length) {
      return recQ.data.recommendations.map((r, i) => {
        const demo = DEMO[i] ?? DEMO[2]!
        return {
          ...demo,
          ...r,
          tag: productTypeLabels[r.productType] ?? 'Кредит',
          badge:
            r.matchScore >= 85
              ? 'Соответствует цели и сумме'
              : r.warnings[0] ?? 'Условия требуют внимания',
          badgeTone: (r.matchScore >= 85 ? 'ok' : r.warnings.length ? 'warn' : 'muted') as
            | 'ok'
            | 'warn'
            | 'muted',
          amountMax: r.recommendedAmount * 2,
          termMax: r.recommendedTerm + 12,
          estimatedMonthlyPayment:
            r.estimatedMonthlyPayment ||
            Math.round(annuityPayment(draft.amount, r.estimatedRate || 17.3, draft.termMonths)),
        }
      })
    }
    return DEMO.map((p) => ({
      ...p,
      estimatedMonthlyPayment:
        p.productType === 'overdraft'
          ? 0
          : Math.round(annuityPayment(filterAmount, p.estimatedRate, filterTerm)),
      recommendedAmount: filterAmount,
      recommendedTerm: filterTerm,
    }))
  }, [recQ.data, draft.amount, draft.termMonths, filterAmount, filterTerm])

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (search && !p.productName.toLowerCase().includes(search.toLowerCase())) return false
      if (p.estimatedRate > rateMax) return false
      if (types[p.productType] === false) return false
      if (p.productType === 'working_capital' && !types.working_capital) return false
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'rate') return a.estimatedRate - b.estimatedRate
      if (sort === 'score') return b.matchScore - a.matchScore
      const ap = a.estimatedMonthlyPayment || 1e12
      const bp = b.estimatedMonthlyPayment || 1e12
      return ap - bp
    })
    return list
  }, [products, search, rateMax, types, sort])

  function toggleCompare(id: string) {
    setDraft((d) => {
      const has = d.compareIds.includes(id)
      const compareIds = has
        ? d.compareIds.filter((x) => x !== id)
        : [...d.compareIds, id].slice(0, 3)
      return { ...d, compareIds }
    })
  }

  function resetFilters() {
    setFilterAmount(draft.amount)
    setFilterTerm(draft.termMonths)
    setRateMax(21)
    setTypes({ working_capital: true, overdraft: true, investment: true, leasing: false })
    setCollateral({ none: true, guarantee: true, property: false })
    setSpeed('1')
    setSearch('')
  }

  function applyFilters() {
    setDraft((d) => ({ ...d, amount: filterAmount, termMonths: filterTerm }))
  }

  function badgeBg(tone: DemoProduct['badgeTone']) {
    if (tone === 'ok') return { bg: '#E8F6EE', color: '#1B8A5A' }
    if (tone === 'warn') return { bg: '#FFF0E0', color: '#C45A12' }
    return { bg: '#EEF1F4', color: '#5A6B7D' }
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        Подбор и сравнение{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Результаты подбора
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
            Результаты подбора
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            {goalTitle(draft.goalKey)} · {formatMoney(draft.amount)} · {draft.termMonths} мес ·
            найдено {filtered.length} продукта, {REJECTED.length} не подошли
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0}>
          <Button
            variant="outlined"
            color="secondary"
            disabled={draft.compareIds.length < 2}
            onClick={() => navigate('/app/compare')}
          >
            Сравнить ({draft.compareIds.length})
          </Button>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/app/recommendations')}>
            Изменить цель
          </Button>
        </Stack>
      </Stack>

      <SelectionStepper active={3} />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
              }}
            >
              Фильтры
            </Typography>
            <Button
              size="small"
              onClick={resetFilters}
              sx={{ color: '#EF3124', fontWeight: 700, textTransform: 'none', minWidth: 0 }}
            >
              Сбросить
            </Button>
          </Stack>

          <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mb: 0.35 }}>Сумма</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 750, mb: 0.5 }}>
            {formatMoney(filterAmount)}
          </Typography>
          <Slider
            value={filterAmount}
            min={500_000}
            max={30_000_000}
            step={100_000}
            onChange={(_, v) => setFilterAmount(v as number)}
            sx={{ color: '#EF3124', mb: 1.75, '& .MuiSlider-rail': { bgcolor: '#E8EBEE' } }}
          />

          <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mb: 0.35 }}>Срок</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 750, mb: 0.5 }}>
            {filterTerm} мес
          </Typography>
          <Slider
            value={filterTerm}
            min={6}
            max={60}
            onChange={(_, v) => setFilterTerm(v as number)}
            sx={{ color: '#EF3124', mb: 1.75, '& .MuiSlider-rail': { bgcolor: '#E8EBEE' } }}
          />

          <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mb: 0.35 }}>Ставка до</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 750, mb: 0.5 }}>{rateMax}%</Typography>
          <Slider
            value={rateMax}
            min={12}
            max={30}
            step={0.5}
            onChange={(_, v) => setRateMax(v as number)}
            sx={{ color: '#EF3124', mb: 2, '& .MuiSlider-rail': { bgcolor: '#E8EBEE' } }}
          />

          <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#0B1F35', mb: 0.75 }}>
            Тип продукта
          </Typography>
          <Stack sx={{ mb: 1.5 }}>
            {TYPE_FILTERS.map((t) => (
              <FormControlLabel
                key={t.key}
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(types[t.key])}
                    onChange={(e) => setTypes((s) => ({ ...s, [t.key]: e.target.checked }))}
                    sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5 }}>{t.label}</Typography>}
              />
            ))}
          </Stack>

          <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#0B1F35', mb: 0.75 }}>
            Обеспечение
          </Typography>
          <Stack sx={{ mb: 1.75 }}>
            {(
              [
                ['none', 'Без залога'],
                ['guarantee', 'Поручительство владельцев'],
                ['property', 'Залог имущества'],
              ] as const
            ).map(([k, label]) => (
              <FormControlLabel
                key={k}
                control={
                  <Checkbox
                    size="small"
                    checked={collateral[k]}
                    onChange={(e) => setCollateral((c) => ({ ...c, [k]: e.target.checked }))}
                    sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5 }}>{label}</Typography>}
              />
            ))}
          </Stack>

          <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#0B1F35', mb: 0.75 }}>
            Скорость решения
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mb: 2 }}>
            {(['1', '3'] as const).map((s) => (
              <Button
                key={s}
                size="small"
                variant={speed === s ? 'contained' : 'outlined'}
                color={speed === s ? 'secondary' : 'inherit'}
                onClick={() => setSpeed(s)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: 'rgba(11,31,53,0.14)',
                  bgcolor: speed === s ? undefined : '#fff',
                  color: speed === s ? undefined : '#0B1F35',
                }}
              >
                {s} {s === '1' ? 'день' : 'дня'}
              </Button>
            ))}
          </Stack>

          <Button fullWidth variant="outlined" color="secondary" onClick={applyFilters}>
            Применить фильтры
          </Button>
        </Box>

        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск по названию продукта"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchRoundedIcon sx={{ color: '#9AA5B1', mr: 1, fontSize: 20 }} />,
              }}
              sx={{ bgcolor: '#fff', borderRadius: 2 }}
            />
            <TextField
              select
              size="small"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              sx={{ minWidth: 200, bgcolor: '#fff' }}
            >
              <MenuItem value="payment">Сортировка: По платежу</MenuItem>
              <MenuItem value="rate">Сортировка: По ставке</MenuItem>
              <MenuItem value="score">Сортировка: По соответствию</MenuItem>
            </TextField>
          </Stack>

          {filtered.map((p, idx) => {
            const selected = draft.compareIds.includes(p.productId)
            const tone = badgeBg(p.badgeTone)
            const highlight = idx === 0
            return (
              <Box
                key={p.productId}
                sx={{
                  ...tileSx,
                  border: highlight
                    ? '1.5px solid #EF3124'
                    : '1px solid rgba(11,31,53,0.08)',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{ mb: 0.75 }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography
                    sx={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 800,
                      fontSize: 18,
                      color: '#0B1F35',
                    }}
                  >
                    {p.productName}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.3,
                        borderRadius: 999,
                        bgcolor: '#EEF1F4',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#5A6B7D',
                      }}
                    >
                      {p.tag}
                    </Box>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.3,
                        borderRadius: 999,
                        bgcolor: tone.bg,
                        color: tone.color,
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {p.badge}
                    </Box>
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <Metric label="Ставка" value={`от ${p.estimatedRate.toLocaleString('ru-RU')}%`} />
                  <Metric
                    label="Сумма"
                    value={`до ${(p.amountMax / 1_000_000).toLocaleString('ru-RU')} млн ₽`}
                  />
                  <Metric label="Срок" value={`до ${p.termMax} мес`} />
                  <Metric
                    label="Платёж"
                    value={
                      p.estimatedMonthlyPayment
                        ? `≈ ${formatMoney(p.estimatedMonthlyPayment)}`
                        : 'по факту'
                    }
                  />
                </Box>

                <Stack spacing={0.65} sx={{ mb: 1.75 }}>
                  {p.reasons.map((r) => (
                    <Stack key={r} direction="row" spacing={0.85} alignItems="center">
                      <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#1B8A5A' }} />
                      <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{r}</Typography>
                    </Stack>
                  ))}
                  {p.warnings.map((w) => (
                    <Stack key={w} direction="row" spacing={0.85} alignItems="center">
                      <WarningAmberRoundedIcon sx={{ fontSize: 16, color: '#C45A12' }} />
                      <Typography sx={{ fontSize: 13, color: '#5A6B7D' }}>{w}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  spacing={1.25}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected}
                        onChange={() => toggleCompare(p.productId)}
                        sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                      />
                    }
                    label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Сравнить</Typography>}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setSelectedProduct(p.productId)
                        navigate('/app/calculator')
                      }}
                    >
                      Подробнее
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        setSelectedProduct(p.productId)
                        setDraft((d) => ({ ...d, selectedProductId: p.productId }))
                        saveSelectionDraft(
                          { ...draft, selectedProductId: p.productId, compareIds: draft.compareIds },
                          companyId,
                        )
                        navigate('/app/applications/new')
                      }}
                    >
                      Выбрать
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )
          })}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={1}
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: 2.5,
              bgcolor: '#EEF1F4',
            }}
          >
            <Typography sx={{ fontSize: 13.5, color: '#5A6B7D' }}>
              Не подошли ({REJECTED.length}): {REJECTED.join(', ')}
            </Typography>
            <Button size="small" sx={{ color: '#EF3124', fontWeight: 700, textTransform: 'none' }}>
              Показать →
            </Button>
          </Stack>

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
              Соответствие критериям не гарантирует одобрение. Платёж — ориентировочная оценка по
              ставке от.
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0B1F35' }}>{value}</Typography>
    </Box>
  )
}
