import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { compareCreditProducts, listProducts, type CreditCompareRow } from '@/api/credit'
import { productTypeLabels } from '@/data/labels'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import {
  DEMO_PRODUCTS,
  overpayFor,
  paymentLabel,
  rateLabel,
  resolveCompareProducts,
  rowValuesEqual,
  type DemoProduct,
} from '@/features/selection/demoProducts'
import { goalTitle } from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import type { CreditProduct } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

function feeLabel(p?: CreditProduct): string {
  const fees = p?.fees ?? []
  if (!fees.length) return '0 ₽'
  return fees
    .map((f) =>
      f.type === 'percent'
        ? `${String(f.value).replace('.', ',')}%`
        : `${Math.round(f.value).toLocaleString('ru-RU')} ₽`,
    )
    .join(' · ')
}

function rowToDemo(
  row: CreditCompareRow,
  catalog: CreditProduct | undefined,
  amount: number,
  term: number,
): DemoProduct {
  const estimatedRate = row.rateMin || catalog?.rateMin || 17.3
  const payment =
    row.estimatedMonthlyPayment ??
    (row.productType === 'overdraft' || row.amountMax < amount
      ? 0
      : Math.round(annuityPayment(amount, estimatedRate, term)))
  const typeLabel = productTypeLabels[row.productType] ?? 'Кредит'
  return {
    productId: row.productId,
    productType: row.productType,
    productName: row.productName,
    matchScore: 80,
    eligibleByBasicRules: row.fits !== false,
    estimatedMonthlyPayment: payment,
    estimatedRate,
    recommendedAmount: amount,
    recommendedTerm: term,
    reasons: row.notes,
    warnings: [],
    tag: typeLabel,
    badge: row.fits === false ? 'Не подходит под параметры' : 'Соответствует',
    badgeTone: row.fits === false ? 'warn' : 'ok',
    amountMax: row.amountMax,
    termMax: row.termMax,
    fee: feeLabel(catalog),
    collateral: row.collateralRequired
      ? 'Требуется залог / поручительство'
      : 'Поручительство · без залога',
    reviewDays: 1,
    earlyRepayment: 'По условиям договора',
    fitsGoal: row.fits === false ? 'no' : 'yes',
    criteriaMatch: row.notes[0] ?? (row.fits === false ? 'ограничения' : 'подходит'),
    shortType: typeLabel,
  }
}

function catalogToDemo(p: CreditProduct, amount: number, term: number): DemoProduct {
  const canCover = p.amountMax >= amount
  const rate = p.rateMin || 17.3
  const payment =
    p.type === 'overdraft' || !canCover ? 0 : Math.round(annuityPayment(amount, rate, term))
  const typeLabel = productTypeLabels[p.type] ?? 'Кредит'
  return {
    productId: p.id,
    productType: p.type,
    productName: p.name,
    matchScore: 70,
    eligibleByBasicRules: canCover,
    estimatedMonthlyPayment: payment,
    estimatedRate: rate,
    recommendedAmount: amount,
    recommendedTerm: term,
    reasons: [],
    warnings: canCover ? [] : ['Лимит ниже запрошенной суммы'],
    tag: typeLabel,
    badge: canCover ? 'Соответствует' : 'Лимит ниже суммы',
    badgeTone: canCover ? 'ok' : 'warn',
    amountMax: p.amountMax,
    termMax: p.termMax,
    fee: feeLabel(p),
    collateral: p.collateralRequired
      ? 'Требуется залог / поручительство'
      : 'Поручительство · без залога',
    reviewDays: 1,
    earlyRepayment: 'По условиям договора',
    fitsGoal: canCover ? 'yes' : 'partial',
    criteriaMatch: canCover ? 'подходит' : 'частично',
    shortType: typeLabel,
  }
}

type Row = {
  key: string
  label: string
  cells: (p: DemoProduct, amount: number, term: number) => ReactNode
  text: (p: DemoProduct, amount: number, term: number) => string
}

export function ComparePage() {
  const navigate = useNavigate()
  const { companyId, compareIds, setSelectedProduct } = useAppStore()
  const draft = loadSelectionDraft(companyId)
  const ids = (compareIds.length >= 2 ? compareIds : draft.compareIds).slice(0, 3)
  const [diffOnly, setDiffOnly] = useState(false)

  const amount = draft.amount || 5_000_000
  const term = draft.termMonths || 24

  const catalogQ = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })
  const compareQ = useQuery({
    queryKey: ['credit-compare', ids, amount, term],
    queryFn: () => compareCreditProducts({ productIds: ids, amount, termMonths: term }),
    enabled: ids.length >= 2,
    retry: false,
  })

  const products = useMemo(() => {
    const catalog = catalogQ.data ?? []
    const byId = new Map(catalog.map((p) => [p.id, p]))
    if (compareQ.data?.length) {
      return compareQ.data.map((row) => rowToDemo(row, byId.get(row.productId), amount, term))
    }
    const fromCatalog = ids
      .map((id) => byId.get(id))
      .filter((p): p is CreditProduct => Boolean(p))
    if (fromCatalog.length >= 2) {
      return fromCatalog.map((p) => catalogToDemo(p, amount, term))
    }
    const hasDemo = ids.some((id) => DEMO_PRODUCTS.some((p) => p.productId === id))
    if (hasDemo) return resolveCompareProducts(ids, amount, term)
    return []
  }, [compareQ.data, catalogQ.data, ids, amount, term])

  const primary = products.find((p) => p.productId === 'biz-oborot') ?? products[0]

  const rows: Row[] = useMemo(
    () => [
      {
        key: 'type',
        label: 'Тип продукта',
        text: (p) => p.shortType,
        cells: (p) => p.shortType,
      },
      {
        key: 'rate',
        label: 'Ставка',
        text: (p) => rateLabel(p),
        cells: (p) => (
          <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35' }}>
            {rateLabel(p).split(' · ')[0]}
            {p.rateNote === 'лучшая' && (
              <Box component="span" sx={{ color: '#1B8A5A', fontWeight: 750 }}>
                {' '}
                · лучшая
              </Box>
            )}
            {p.rateNote === 'на остаток' && (
              <Box component="span" sx={{ color: '#7A8795', fontWeight: 600 }}>
                {' '}
                · на остаток
              </Box>
            )}
          </Typography>
        ),
      },
      {
        key: 'maxAmount',
        label: 'Максимальная сумма',
        text: (p) => `до ${(p.amountMax / 1_000_000).toLocaleString('ru-RU')} млн ₽`,
        cells: (p) => (
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 700,
              color: p.amountMax < amount ? '#EF3124' : '#0B1F35',
            }}
          >
            до {(p.amountMax / 1_000_000).toLocaleString('ru-RU')} млн ₽
          </Typography>
        ),
      },
      {
        key: 'term',
        label: 'Срок',
        text: (p) => `до ${p.termMax} мес`,
        cells: (p) => `до ${p.termMax} мес`,
      },
      {
        key: 'payment',
        label: `Платёж при ${formatMoney(amount)} / ${term} мес`,
        text: (p) => paymentLabel(p, amount),
        cells: (p) => {
          const label = paymentLabel(p, amount)
          const bad = label.startsWith('Недоступно')
          return (
            <Typography
              sx={{ fontSize: 13.5, fontWeight: 700, color: bad ? '#EF3124' : '#0B1F35', lineHeight: 1.35 }}
            >
              {label}
            </Typography>
          )
        },
      },
      {
        key: 'overpay',
        label: `Переплата за ${term} мес`,
        text: (p) => {
          if (!p.estimatedMonthlyPayment || p.amountMax < amount) return '—'
          return `≈ ${formatMoney(overpayFor(p.estimatedMonthlyPayment, amount, term))}`
        },
        cells: (p) => {
          if (!p.estimatedMonthlyPayment || p.amountMax < amount) return '—'
          return `≈ ${formatMoney(overpayFor(p.estimatedMonthlyPayment, amount, term))}`
        },
      },
      {
        key: 'fee',
        label: 'Комиссия за выдачу',
        text: (p) => p.fee,
        cells: (p) => p.fee,
      },
      {
        key: 'collateral',
        label: 'Обеспечение',
        text: (p) => p.collateral,
        cells: (p) => (
          <Typography sx={{ fontSize: 13, color: '#0B1F35', lineHeight: 1.4 }}>{p.collateral}</Typography>
        ),
      },
      {
        key: 'review',
        label: 'Срок рассмотрения',
        text: (p) => `${p.reviewDays} рабочий день`,
        cells: (p) => (
          <Box
            sx={{
              display: 'inline-flex',
              px: 1,
              py: 0.35,
              borderRadius: 999,
              bgcolor: p.reviewDays === 1 ? '#E8F6EE' : '#FFF0E0',
              color: p.reviewDays === 1 ? '#1B8A5A' : '#C45A12',
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            {p.reviewDays === 1 ? '1 рабочий день' : '3 рабочих дня'}
          </Box>
        ),
      },
      {
        key: 'early',
        label: 'Досрочное погашение',
        text: (p) => p.earlyRepayment,
        cells: (p) => p.earlyRepayment,
      },
      {
        key: 'fits',
        label: 'Подходит под цель',
        text: (p) => p.fitsGoal,
        cells: (p) =>
          p.fitsGoal === 'yes' ? (
            <CheckCircleRoundedIcon sx={{ fontSize: 22, color: '#1B8A5A' }} />
          ) : (
            <WarningAmberRoundedIcon sx={{ fontSize: 22, color: '#C45A12' }} />
          ),
      },
      {
        key: 'match',
        label: 'Совпадение критериев',
        text: (p) => p.criteriaMatch,
        cells: (p) => p.criteriaMatch,
      },
    ],
    [amount, term],
  )

  const visibleRows = diffOnly
    ? rows.filter((r) => !rowValuesEqual(products.map((p) => r.text(p, amount, term))))
    : rows

  const comparePending =
    ids.length >= 2 && products.length < 2 && (compareQ.isLoading || catalogQ.isLoading)

  if (comparePending) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', ...tileSx, textAlign: 'center', py: 5 }}>
        <Typography sx={{ color: '#7A8795' }}>Загружаем сравнение…</Typography>
      </Box>
    )
  }

  if (products.length < 2 || !primary) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', ...tileSx, textAlign: 'center', py: 5 }}>
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, mb: 1 }}>
          Выберите 2–3 продукта
        </Typography>
        <Typography sx={{ color: '#7A8795', mb: 2.5 }}>
          Отметьте «Сравнить» на экране результатов подбора.
        </Typography>
        <Button variant="contained" color="primary" component={RouterLink} to="/app/recommendations/results">
          К результатам подбора
        </Button>
      </Box>
    )
  }

  function downloadCompare() {
    const header = ['Параметр', ...products.map((p) => p.productName)].join('\t')
    const body = rows
      .map((r) => [r.label, ...products.map((p) => r.text(p, amount, term))].join('\t'))
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sravnenie-kreditov.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/recommendations/results"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Подбор и сравнение
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Сравнение кредитов
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 1.5 }}
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
            Сравнение кредитов
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            При параметрах {formatMoney(amount)} · {term} мес · цель «{goalTitle(draft.goalKey)}»
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexShrink={0} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" color="secondary" onClick={downloadCompare}>
            Скачать сравнение
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setSelectedProduct(primary.productId)
              saveSelectionDraft({ ...draft, selectedProductId: primary.productId }, companyId)
              navigate('/app/applications/new')
            }}
          >
            Выбрать {primary.productName}
          </Button>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`${(amount / 1_000_000).toLocaleString('ru-RU')} млн ₽`}
            sx={{ bgcolor: '#0B1F35', color: '#fff', fontWeight: 700, borderRadius: 999 }}
          />
          <Chip
            label={`${term} мес`}
            sx={{ bgcolor: '#0B1F35', color: '#fff', fontWeight: 700, borderRadius: 999 }}
          />
          <Chip
            label="Без залога"
            sx={{ bgcolor: '#0B1F35', color: '#fff', fontWeight: 700, borderRadius: 999 }}
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={diffOnly}
              onChange={(e) => setDiffOnly(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#EF3124' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#EF3124' },
              }}
            />
          }
          label={
            <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
              Показывать только различия
            </Typography>
          }
        />
      </Stack>

      <Box sx={{ ...tileSx, p: 0, overflow: 'auto', mb: 2 }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 720,
          }}
        >
          <Box component="thead">
            <Box component="tr">
              <Box
                component="th"
                sx={{
                  textAlign: 'left',
                  p: 2,
                  width: 200,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#9AA5B1',
                  borderBottom: '1px solid rgba(11,31,53,0.08)',
                  position: 'sticky',
                  left: 0,
                  bgcolor: '#fff',
                  zIndex: 2,
                }}
              >
                Параметр
              </Box>
              {products.map((p) => (
                <Box
                  key={p.productId}
                  component="th"
                  sx={{
                    textAlign: 'left',
                    p: 2,
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 15,
                    color: '#0B1F35',
                    borderBottom: '1px solid rgba(11,31,53,0.08)',
                    minWidth: 180,
                  }}
                >
                  {p.productName}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {visibleRows.map((row) => (
              <Box
                component="tr"
                key={row.key}
                sx={{
                  '&:last-of-type td': { borderBottom: 0 },
                }}
              >
                <Box
                  component="td"
                  sx={{
                    p: 2,
                    fontSize: 13,
                    fontWeight: 650,
                    color: '#5A6B7D',
                    borderBottom: '1px solid rgba(11,31,53,0.06)',
                    verticalAlign: 'top',
                    position: 'sticky',
                    left: 0,
                    bgcolor: '#fff',
                    zIndex: 1,
                  }}
                >
                  {row.label}
                </Box>
                {products.map((p) => (
                  <Box
                    key={p.productId}
                    component="td"
                    sx={{
                      p: 2,
                      fontSize: 13.5,
                      fontWeight: 650,
                      color: '#0B1F35',
                      borderBottom: '1px solid rgba(11,31,53,0.06)',
                      verticalAlign: 'top',
                    }}
                  >
                    {row.cells(p, amount, term)}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1,
            }}
          >
            Вывод по сравнению
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.55 }}>
            <Box component="span" sx={{ fontWeight: 750, color: '#0B1F35' }}>
              {primary.productName}
            </Box>{' '}
            даёт самый низкий платёж при запрошенной сумме и сроке.
            {products.some((p) => p.productType === 'overdraft') && (
              <>
                {' '}
                Овердрафт не покрывает всю сумму, но может дополнить оборотный кредит как резерв
                ликвидности.
              </>
            )}
          </Typography>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.25,
            }}
          >
            Что учесть
          </Typography>
          <Stack spacing={1.35}>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <WarningAmberRoundedIcon sx={{ fontSize: 20, color: '#C45A12', mt: 0.15 }} />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                  Решение банка может отличаться от расчёта
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25, lineHeight: 1.4 }}>
                  Итоговые условия — после проверки заявки ABC-2026-1042.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.15 }} />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                  Комбинируйте продукты
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#7A8795', mt: 0.25, lineHeight: 1.4 }}>
                  Например 3 млн оборотный + 1–2 млн овердрафт на пик сезона.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
