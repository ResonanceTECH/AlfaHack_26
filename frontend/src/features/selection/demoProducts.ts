import type { CreditRecommendation, ProductType } from '@/types'
import { annuityPayment } from '@/utils/finance'
import { formatMoney } from '@/utils/format'

export type DemoProduct = CreditRecommendation & {
  tag: string
  badge: string
  badgeTone: 'ok' | 'warn' | 'muted'
  amountMax: number
  termMax: number
  rateNote?: string
  fee: string
  collateral: string
  reviewDays: 1 | 3
  earlyRepayment: string
  fitsGoal: 'yes' | 'partial' | 'no'
  criteriaMatch: string
  shortType: string
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    productId: 'biz-oborot',
    productType: 'working_capital',
    productName: 'Бизнес-Оборот',
    matchScore: 92,
    eligibleByBasicRules: true,
    estimatedMonthlyPayment: 248_000,
    estimatedRate: 17.3,
    recommendedAmount: 5_000_000,
    recommendedTerm: 24,
    reasons: [
      'Соответствует цели и сумме',
      'Платёж укладывается в выручку',
      'Без обязательного залога имущества',
    ],
    warnings: [],
    tag: 'Оборотный',
    badge: 'Соответствует цели и сумме',
    badgeTone: 'ok',
    amountMax: 10_000_000,
    termMax: 36,
    rateNote: 'лучшая',
    fee: '0 ₽',
    collateral: 'Поручительство владельцев · без залога',
    reviewDays: 1,
    earlyRepayment: 'Без штрафов',
    fitsGoal: 'yes',
    criteriaMatch: '6 из 6',
    shortType: 'Оборотный кредит',
  },
  {
    productId: 'od-biz',
    productType: 'overdraft',
    productName: 'Овердрафт Бизнес',
    matchScore: 74,
    eligibleByBasicRules: true,
    estimatedMonthlyPayment: 0,
    estimatedRate: 16.9,
    recommendedAmount: 3_000_000,
    recommendedTerm: 12,
    reasons: ['Быстрое решение', 'Гибкое использование лимита'],
    warnings: ['Сумма ниже запрошенной'],
    tag: 'Овердрафт',
    badge: 'Покрывает часть суммы',
    badgeTone: 'warn',
    amountMax: 3_000_000,
    termMax: 12,
    rateNote: 'на остаток',
    fee: '0,5% от лимита',
    collateral: 'Поручительство · лимит по оборотам',
    reviewDays: 1,
    earlyRepayment: 'Без штрафов',
    fitsGoal: 'partial',
    criteriaMatch: '4 из 6',
    shortType: 'Овердрафт',
  },
  {
    productId: 'biz-rost',
    productType: 'investment',
    productName: 'Бизнес-Рост',
    matchScore: 61,
    eligibleByBasicRules: true,
    estimatedMonthlyPayment: 251_000,
    estimatedRate: 18.5,
    recommendedAmount: 5_000_000,
    recommendedTerm: 24,
    reasons: ['Подходит по сроку'],
    warnings: ['Ставка выше базовой', 'Может потребоваться залог'],
    tag: 'Инвестиционный',
    badge: 'Условия выше по ставке',
    badgeTone: 'muted',
    amountMax: 30_000_000,
    termMax: 60,
    fee: '1% от суммы',
    collateral: 'Возможен залог оборудования / поручительство',
    reviewDays: 3,
    earlyRepayment: 'Комиссия 1% в 1-й год',
    fitsGoal: 'yes',
    criteriaMatch: '5 из 6',
    shortType: 'Инвестиционный',
  },
]

export const REJECTED_PRODUCTS = ['Лизинг оборудования', 'Кредит на недвижимость']

export function resolveCompareProducts(
  ids: string[],
  amount: number,
  termMonths: number,
): DemoProduct[] {
  const fromDemo = ids
    .map((id) => DEMO_PRODUCTS.find((p) => p.productId === id))
    .filter(Boolean) as DemoProduct[]

  const list = fromDemo.length
    ? fromDemo
    : DEMO_PRODUCTS.filter((p) => ids.includes(p.productId))

  const base = list.length >= 2 ? list : DEMO_PRODUCTS.slice(0, Math.max(2, ids.length || 3))

  return base.map((p) => {
    const canCover = p.amountMax >= amount
    const payment =
      p.productType === 'overdraft' || !canCover
        ? 0
        : Math.round(annuityPayment(amount, p.estimatedRate, termMonths))
    return {
      ...p,
      recommendedAmount: amount,
      recommendedTerm: termMonths,
      estimatedMonthlyPayment: payment,
    }
  })
}

export function overpayFor(payment: number, amount: number, termMonths: number): number {
  if (!payment) return 0
  return payment * termMonths - amount
}

export function paymentLabel(p: DemoProduct, amount: number): string {
  if (p.productType === 'overdraft' || p.amountMax < amount) {
    return 'Недоступно — лимит ниже суммы'
  }
  if (!p.estimatedMonthlyPayment) return 'по факту'
  return `≈ ${formatMoney(p.estimatedMonthlyPayment)}`
}

export function rateLabel(p: DemoProduct): string {
  const base = `от ${p.estimatedRate.toLocaleString('ru-RU')}%`
  return p.rateNote ? `${base} · ${p.rateNote}` : base
}

export type CompareRowKey =
  | 'type'
  | 'rate'
  | 'maxAmount'
  | 'term'
  | 'payment'
  | 'overpay'
  | 'fee'
  | 'collateral'
  | 'review'
  | 'early'
  | 'fits'
  | 'match'

export function rowValuesEqual(values: string[]): boolean {
  if (values.length < 2) return true
  return values.every((v) => v === values[0])
}

export function productTypeKey(t: ProductType): string {
  return t
}
