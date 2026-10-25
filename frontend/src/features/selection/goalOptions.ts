import type { GoalType } from '@/types'
import type { ReactNode } from 'react'

export type GoalOptionKey =
  | 'working_capital'
  | 'equipment'
  | 'new_point'
  | 'cash_gap'
  | 'refinance'
  | 'renovation'

export type GoalOption = {
  key: GoalOptionKey
  goalType: GoalType
  title: string
  description: string
  limit: string
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    key: 'working_capital',
    goalType: 'inventory_purchase',
    title: 'Пополнение оборотных средств',
    description: 'Закупки, зарплаты, налоги в сезон',
    limit: 'До 10 млн ₽ · до 36 мес.',
  },
  {
    key: 'equipment',
    goalType: 'equipment',
    title: 'Покупка оборудования',
    description: 'Кофемашины, кассы, холодильники',
    limit: 'До 30 млн ₽ · до 60 мес.',
  },
  {
    key: 'new_point',
    goalType: 'new_point',
    title: 'Открытие новой точки',
    description: 'Аренда, ремонт, запуск',
    limit: 'До 15 млн ₽ · до 48 мес.',
  },
  {
    key: 'cash_gap',
    goalType: 'cash_gap',
    title: 'Закрытие кассового разрыва',
    description: 'Овердрафт на 30–60 дней',
    limit: 'До 3 млн ₽ · до 12 мес.',
  },
  {
    key: 'refinance',
    goalType: 'other',
    title: 'Рефинансирование',
    description: 'Перенос кредитов из других банков',
    limit: 'До 20 млн ₽ · до 60 мес.',
  },
  {
    key: 'renovation',
    goalType: 'production_expansion',
    title: 'Ремонт и аренда',
    description: 'Обновление точки, ремонт',
    limit: 'До 5 млн ₽ · до 36 мес.',
  },
]

export const WHEN_OPTIONS = [
  'В ближайшие 2 недели',
  'В течение месяца',
  'Через 1–3 месяца',
  'Позже / гибко',
] as const

export type BudgetLine = {
  id: string
  title: string
  amount: number
  period: string
}

export const DEFAULT_LINES: BudgetLine[] = [
  { id: '1', title: 'Закупка зерна / сырья', amount: 2_400_000, period: 'ноя–янв' },
  { id: '2', title: 'Расходники и упаковка', amount: 650_000, period: 'ноя' },
  { id: '3', title: 'Аванс аренды 2-й точки', amount: 900_000, period: 'дек' },
  { id: '4', title: 'Маркетинг запуска', amount: 450_000, period: 'янв' },
  { id: '5', title: 'Резерв на непредвиденное', amount: 600_000, period: '—' },
]

export type SelectionDraft = {
  goalKey: GoalOptionKey
  amount: number
  termMonths: number
  whenNeeded: string
  description: string
  guarantee: boolean
  lines: BudgetLine[]
  compareIds: string[]
  /** product chosen via «Выбрать» on results */
  selectedProductId?: string | null
}

export const DEFAULT_DRAFT: SelectionDraft = {
  goalKey: 'working_capital',
  amount: 5_000_000,
  termMonths: 24,
  whenNeeded: WHEN_OPTIONS[0],
  description: 'Сезонные закупки зерна и запуск второй точки',
  guarantee: true,
  lines: DEFAULT_LINES,
  compareIds: [],
  selectedProductId: null,
}

export function goalTitle(key: GoalOptionKey): string {
  return GOAL_OPTIONS.find((g) => g.key === key)?.title ?? 'Цель'
}

export function goalTypeOf(key: GoalOptionKey): GoalType {
  return GOAL_OPTIONS.find((g) => g.key === key)?.goalType ?? 'inventory_purchase'
}

/** icon slot filled by pages */
export type GoalIconMap = Record<GoalOptionKey, ReactNode>
