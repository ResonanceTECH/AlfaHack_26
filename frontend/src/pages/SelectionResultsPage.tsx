import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import { formatAiError, postProductSelection, type AiAgentResponse } from '@/api/ai'
import { fetchRecommendations, listProducts } from '@/api/credit'
import { AiAgentReply } from '@/components/ai/AiAgentReply'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import {
  GOAL_OPTIONS,
  goalTitle,
  type SelectionDraft,
} from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import type { CreditProduct, ProductType } from '@/types'
import { productTypeLabels } from '@/data/labels'
type MatchCard = {
  productId: string
  productType: ProductType
  productName: string
  matchScore: number
  estimatedMonthlyPayment: number
  estimatedRate: number
  recommendedAmount: number
  recommendedTerm: number
  reasons: string[]
  warnings: string[]
  tag: string
  badge: string
  badgeTone: 'ok' | 'warn' | 'muted'
  amountMax: number
  termMax: number
}

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const TYPE_FILTERS: { key: ProductType | 'leasing' | 'credit_line'; label: string }[] = [
  { key: 'working_capital', label: 'Оборотный кредит' },
  { key: 'overdraft', label: 'Овердрафт' },
  { key: 'investment', label: 'Инвестиционный' },
  { key: 'credit_line', label: 'Кредитная линия' },
  { key: 'leasing', label: 'Лизинг' },
]

export function SelectionResultsPage() {
  const navigate = useNavigate()
  const { companyId, goal, setCompareIds, setSelectedProduct } = useAppStore()
  const [draft, setDraft] = useState<SelectionDraft>(() => loadSelectionDraft(companyId))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'payment' | 'rate' | 'score'>('payment')
  const [rateMax, setRateMax] = useState(30)
  const [types, setTypes] = useState<Record<string, boolean>>({
    working_capital: true,
    overdraft: true,
    investment: true,
    credit_line: true,
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
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiReply, setAiReply] = useState<AiAgentResponse | null>(null)
  const [aiCatalog, setAiCatalog] = useState<CreditProduct[]>([])

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

  const goalType =
    GOAL_OPTIONS.find((g) => g.key === draft.goalKey)?.goalType ?? goal?.goalType

  const recQ = useQuery({
    queryKey: [
      'credit-matches',
      companyId,
      goal?.id,
      draft.amount,
      draft.termMonths,
      goalType,
    ],
    queryFn: () =>
      fetchRecommendations({
        companyId: companyId!,
        fundingNeedId: goal?.id,
        amount: draft.amount,
        termMonths: draft.termMonths,
        goalType,
      }),
    enabled: Boolean(companyId && draft.amount && draft.termMonths && goalType),
    retry: false,
  })

  const products: MatchCard[] = useMemo(() => {
    if (!recQ.data?.recommendations?.length) return []
    return recQ.data.recommendations.map((r) => ({
      productId: r.productId,
      productType: r.productType,
      productName: r.productName,
      matchScore: r.matchScore,
      estimatedRate: r.estimatedRate,
      recommendedAmount: r.recommendedAmount,
      recommendedTerm: r.recommendedTerm,
      reasons: r.reasons,
      warnings: r.warnings,
      tag: productTypeLabels[r.productType] ?? 'Кредит',
      badge:
        r.matchScore >= 85
          ? 'Соответствует цели и сумме'
          : r.warnings[0] ?? 'Условия требуют внимания',
      badgeTone: (r.matchScore >= 85 ? 'ok' : r.warnings.length ? 'warn' : 'muted') as
        | 'ok'
        | 'warn'
        | 'muted',
      amountMax: r.recommendedAmount ? r.recommendedAmount * 2 : draft.amount * 2,
      termMax: (r.recommendedTerm || draft.termMonths) + 12,
      estimatedMonthlyPayment:
        r.estimatedMonthlyPayment ||
        Math.round(annuityPayment(draft.amount, r.estimatedRate || 17.3, draft.termMonths)),
    }))
  }, [recQ.data, draft.amount, draft.termMonths])

  async function runAiSelection() {
    if (!companyId || !aiQuestion.trim() || aiBusy) return
    setAiBusy(true)
    setAiError(null)
    setAiReply(null)
    setAiCatalog([])
    try {
      const res = await postProductSelection(companyId, {
        question: aiQuestion.trim(),
        amount: draft.amount || undefined,
        termMonths: draft.termMonths || undefined,
      })
      setAiReply(res)
      if (res.productIds?.length) {
        const catalog = await listProducts()
        setAiCatalog(catalog.filter((p) => res.productIds!.includes(p.id)))
      }
    } catch (e) {
      setAiError(formatAiError(e, 'Не удалось подобрать продукт'))
    } finally {
      setAiBusy(false)
    }
  }

  function applyPrefill() {
    if (!aiReply?.prefill) return
    const p = aiReply.prefill
    setDraft((d) => ({
      ...d,
      amount: p.amount ?? d.amount,
      termMonths: p.termMonths ?? d.termMonths,
      selectedProductId: p.productId ?? d.selectedProductId,
    }))
    if (p.productId) setSelectedProduct(p.productId)
    if (p.amount) setFilterAmount(p.amount)
    if (p.termMonths) setFilterTerm(p.termMonths)
  }

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
    setRateMax(30)
    setTypes({
      working_capital: true,
      overdraft: true,
      investment: true,
      credit_line: true,
      leasing: false,
    })
    setCollateral({ none: true, guarantee: true, property: false })
    setSpeed('1')
    setSearch('')
  }

  function applyFilters() {
    setDraft((d) => ({ ...d, amount: filterAmount, termMonths: filterTerm }))
  }

  function badgeBg(tone: MatchCard['badgeTone']) {
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
            {recQ.isLoading
              ? ' подбираем…'
              : recQ.isError
                ? ' ошибка подбора'
                : ` найдено ${filtered.length}`}
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

          <Box sx={{ ...tileSx, mb: 0 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                color: '#0B1F35',
                mb: 0.5,
              }}
            >
              AI-подбор продукта
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#8A96A3', mb: 1, lineHeight: 1.4 }}>
              Match score — соответствие потребности каталогу, не кредитная оценка и не вероятность
              одобрения. Маппинг scoring_product задаёт backend.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Например: нужен станок"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
              <Button
                variant="contained"
                color="primary"
                disabled={aiBusy || !aiQuestion.trim() || !companyId}
                onClick={() => void runAiSelection()}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
              >
                {aiBusy ? <CircularProgress size={18} color="inherit" /> : 'Подобрать'}
              </Button>
            </Stack>
            {aiError && (
              <Alert severity="error" sx={{ mb: 1, borderRadius: 2 }}>
                {aiError}
              </Alert>
            )}
            {aiReply && (
              <Box sx={{ mb: 1 }}>
                <AiAgentReply data={aiReply} dense />
                {aiReply.prefill && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={applyPrefill}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                  >
                    Перенести параметры в форму
                  </Button>
                )}
                {aiReply.productIds && aiReply.productIds.length === 0 && (
                  <Typography sx={{ mt: 1, fontSize: 13, color: '#7A8795' }}>
                    Подходящих продуктов в каталоге нет.
                  </Typography>
                )}
                {aiCatalog.length > 0 && (
                  <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                    {aiCatalog.map((p) => (
                      <Box
                        key={p.id}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: '#F7F8FA',
                          border: '1px solid rgba(11,31,53,0.06)',
                        }}
                      >
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35' }}>
                          {p.name}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#7A8795' }}>
                          {formatMoney(p.amountMin)}–{formatMoney(p.amountMax)} · {p.termMin}–
                          {p.termMax} мес · {p.rateMin}–{p.rateMax}%
                        </Typography>
                        <Button
                          size="small"
                          sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700, color: '#EF3124' }}
                          onClick={() => {
                            setSelectedProduct(p.id)
                            setDraft((d) => ({ ...d, selectedProductId: p.id }))
                            navigate('/app/applications/new')
                          }}
                        >
                          Выбрать
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Box>

          {recQ.isLoading && (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#EF3124' }} />
            </Box>
          )}
          {recQ.isError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              Не удалось получить подбор по правилам. Проверьте финансы компании и параметры
              суммы/срока/цели.
            </Alert>
          )}
          {!recQ.isLoading && !recQ.isError && filtered.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Подходящих продуктов нет — демо-карточки не подставляем. Измените сумму, срок или
              цель.
            </Alert>
          )}

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
