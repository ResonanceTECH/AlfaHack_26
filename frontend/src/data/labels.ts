import type {
  ApplicationStatus,
  GoalType,
  ProductType,
  TransactionCategory,
  UserRole,
} from '@/types'

export const goalLabels: Record<GoalType, string> = {
  inventory_purchase: 'Закупка товаров',
  new_point: 'Открытие точки',
  equipment: 'Покупка оборудования',
  production_expansion: 'Расширение производства',
  cash_gap: 'Кассовый разрыв',
  other: 'Другая цель',
}

export const goalDescriptions: Record<GoalType, string> = {
  inventory_purchase: 'Пополнение товарных запасов и материалов',
  new_point: 'Ремонт, аренда, оборудование, персонал',
  equipment: 'Приобретение и монтаж оборудования бизнеса',
  production_expansion: 'Увеличение мощностей и развитие бизнеса',
  cash_gap: 'Покрытие временного дефицита оборотных средств',
  other: 'Опишите цель в свободном режиме',
}

export const goalTypeOrder: GoalType[] = [
  'inventory_purchase',
  'new_point',
  'equipment',
  'production_expansion',
  'cash_gap',
  'other',
]

export const productTypeLabels: Record<ProductType, string> = {
  working_capital: 'Оборотный кредит',
  investment: 'Инвестиционный кредит',
  overdraft: 'Овердрафт',
  credit_line: 'Кредитная линия',
}

export const statusLabels: Record<ApplicationStatus, string> = {
  draft: 'Черновик',
  submitted: 'Отправлена',
  in_review: 'На рассмотрении',
  docs_requested: 'Запрос документов',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  issued: 'Выдана',
}

export const statusColors: Record<
  ApplicationStatus,
  'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary'
> = {
  draft: 'default',
  submitted: 'info',
  in_review: 'primary',
  docs_requested: 'warning',
  approved: 'success',
  rejected: 'error',
  issued: 'success',
}

export const roleLabels: Record<UserRole, string> = {
  entrepreneur: 'Предприниматель',
  accountant: 'Бухгалтер',
  analyst: 'Кредитный аналитик',
  manager: 'Кредитный менеджер',
  risk_analyst: 'Риск-аналитик',
  admin: 'Администратор',
}

export const categoryLabels: Record<TransactionCategory, string> = {
  revenue: 'Выручка',
  opex: 'Опер. расходы',
  salary: 'Зарплата',
  tax: 'Налоги',
  rent: 'Аренда',
  loan_in: 'Получение кредита',
  loan_out: 'Погашение кредита',
  transfer_internal: 'Внутренний перевод',
  supplier: 'Поставщики',
  other: 'Прочее',
}

export const goalCostFields: Record<GoalType, { key: string; label: string }[]> = {
  inventory_purchase: [
    { key: 'batchCost', label: 'Стоимость партии' },
    { key: 'supplierPayment', label: 'Оплата поставщику до продаж' },
    { key: 'logistics', label: 'Логистика и хранение' },
  ],
  new_point: [
    { key: 'renovation', label: 'Ремонт' },
    { key: 'rentDeposit', label: 'Аренда / депозит' },
    { key: 'equipment', label: 'Оборудование' },
    { key: 'staff', label: 'Персонал на старт' },
    { key: 'workingReserve', label: 'Оборотный резерв' },
  ],
  equipment: [
    { key: 'equipmentCost', label: 'Стоимость оборудования' },
    { key: 'install', label: 'Монтаж' },
    { key: 'delivery', label: 'Доставка' },
  ],
  production_expansion: [
    { key: 'capex', label: 'Инвестиции в мощности' },
    { key: 'extraOpex', label: 'Доп. операционные расходы' },
    { key: 'workingCapital', label: 'Оборотный капитал' },
  ],
  cash_gap: [
    { key: 'upcomingObligations', label: 'Предстоящие обязательства' },
    { key: 'bridgePeriod', label: 'Резерв на период ожидания поступлений' },
  ],
  other: [
    { key: 'budget', label: 'Бюджет проекта' },
    { key: 'misc', label: 'Прочие затраты' },
  ],
}

export const industries = [
  'Общественное питание',
  'Розничная торговля',
  'Оптовая торговля',
  'Производство',
  'IT и цифровые услуги',
  'Строительство',
  'Логистика',
  'Услуги для бизнеса',
]

export const regions = [
  'Москва',
  'Санкт-Петербург',
  'Московская область',
  'Краснодарский край',
  'Республика Татарстан',
  'Свердловская область',
  'Новосибирская область',
]
