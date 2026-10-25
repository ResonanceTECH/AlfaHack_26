export type AnalystCaseStatus = string

export type AnalystCase = {
  id: string
  /** Human-readable application number (ABC-…); id is UUID */
  number?: string
  company: string
  inn: string
  product: string
  amount: number
  termMonths: number
  status: AnalystCaseStatus
  slaLabel: string
  slaUrgent?: boolean
  analyst: string
  nextStep: string
  purpose: string
  assignedToMe?: boolean
}

export const DEMO_CASES: AnalystCase[] = [
  {
    id: 'ABC-2026-1042',
    number: 'ABC-2026-1042',
    company: 'ООО «Кофе Плюс»',
    inn: '7701234567',
    product: 'Оборотный кредит',
    amount: 1_500_000,
    termMonths: 24,
    status: 'IN_REVIEW',
    slaLabel: 'SLA 3ч 20м',
    slaUrgent: true,
    analyst: 'Иванова А.С.',
    nextStep: 'Проверить документы',
    purpose: 'Пополнение оборотных средств: зерно и упаковка',
    assignedToMe: true,
  },
  {
    id: 'ABC-2026-1020',
    company: 'ООО «Нова Трейд»',
    inn: '7722334455',
    product: 'Оборотный кредит',
    amount: 3_200_000,
    termMonths: 18,
    status: 'DECISION_PENDING',
    slaLabel: 'SLA < 4ч',
    slaUrgent: true,
    analyst: 'Иванова А.С.',
    nextStep: 'Подготовить решение',
    purpose: 'Закупка партии электроники',
    assignedToMe: true,
  },
  {
    id: 'ABC-2026-1011',
    company: 'ИП Смирнов К.А.',
    inn: '503012345678',
    product: 'Инвестиционный кредит',
    amount: 4_800_000,
    termMonths: 36,
    status: 'RISK_REVIEW',
    slaLabel: 'SLA 11ч',
    analyst: 'Иванова А.С.',
    nextStep: 'Оценка риска',
    purpose: 'Открытие второй точки',
    assignedToMe: true,
  },
  {
    id: 'ABC-2026-0995',
    company: 'ООО «Логистик Про»',
    inn: '7811223344',
    product: 'Кредитная линия',
    amount: 8_000_000,
    termMonths: 24,
    status: 'WAITING_FOR_CLIENT',
    slaLabel: 'SLA 28ч',
    analyst: 'Иванова А.С.',
    nextStep: 'Ожидание ответа клиента',
    purpose: 'Пополнение оборотного капитала',
    assignedToMe: true,
  },
  {
    id: 'ABC-2026-0988',
    company: 'ИП Петрова',
    inn: '770998877665',
    product: 'Оборотный кредит',
    amount: 900_000,
    termMonths: 12,
    status: 'COUNTEROFFERED',
    slaLabel: 'SLA истёк',
    slaUrgent: true,
    analyst: 'Иванова А.С.',
    nextStep: 'Ответ по контрпредложению',
    purpose: 'Закупка оборудования',
    assignedToMe: true,
  },
  {
    id: 'ABC-2026-1055',
    company: 'ООО «Хлеб и Ко»',
    inn: '5401122334',
    product: 'Овердрафт',
    amount: 1_200_000,
    termMonths: 12,
    status: 'SUBMITTED',
    slaLabel: 'SLA 18ч',
    analyst: '—',
    nextStep: 'Взять в работу',
    purpose: 'Кассовые разрывы',
    assignedToMe: false,
  },
  {
    id: 'ABC-2026-1061',
    company: 'ООО «МеталлСервис»',
    inn: '6688001122',
    product: 'Оборотный кредит',
    amount: 2_400_000,
    termMonths: 18,
    status: 'DOCS_REQUESTED',
    slaLabel: 'SLA 22ч',
    analyst: '—',
    nextStep: 'Назначить аналитика',
    purpose: 'Закупка сырья',
    assignedToMe: false,
  },
]

/** Fallback for sidebar until first case opened; queue resolves real UUID */
export const DEFAULT_CASE_ID = ''

export function getCase(id?: string): AnalystCase {
  return DEMO_CASES.find((c) => c.id === id) ?? DEMO_CASES[0]!
}

export const CASE_TABS = [
  { key: '', label: 'Обзор' },
  { key: 'company', label: 'Компания' },
  { key: 'finance', label: 'Финансы' },
  { key: 'documents', label: 'Документы' },
  { key: 'checks', label: 'Проверки' },
  { key: 'risks', label: 'Риски' },
  { key: 'explainability', label: 'Объяснимость' },
  { key: 'ai', label: 'Чат' },
  { key: 'decision', label: 'Решение' },
  { key: 'history', label: 'История' },
] as const

export type CaseTabKey = (typeof CASE_TABS)[number]['key']

export const COMPANY_PROFILE = {
  type: 'ООО',
  name: 'ООО «Кофе Плюс»',
  inn: '7701234567',
  ogrn: '1197746123456',
  registeredAt: '14.03.2019',
  age: '6 лет 7 мес.',
  okved: '56.10 — Рестораны и кафе',
  source: 'Демо-реестр',
  verified: true,
}

export const APPLICANT = {
  fullName: 'Иванов Пётр Сергеевич',
  role: 'Генеральный директор / учредитель 100%',
  phone: '+7 (495) 123-45-67',
  email: 'petr@coffeeplus.ru',
  history: '1 активная · 0 отказов',
}

export const FIN_KPIS = [
  { label: 'Выручка / мес', value: '4,8 млн ₽' },
  { label: 'Расходы / мес', value: '4,1 млн ₽' },
  { label: 'NCF', value: '+420 тыс ₽' },
  { label: 'Долговая нагрузка', value: '18%' },
  { label: 'Запрашиваемый платёж', value: '78 тыс ₽' },
  { label: 'DSCR', value: '1,42' },
]

export const DOCUMENTS = [
  { id: 'd1', name: 'Паспорт руководителя', size: '2.1 МБ', kind: 'PDF', status: 'accepted' as const },
  { id: 'd2', name: 'Выписка ЕГРЮЛ', size: '0.4 МБ', kind: 'PDF', status: 'accepted' as const },
  { id: 'd3', name: 'Выписка по счёту (6 мес.)', size: '1.8 МБ', kind: 'CSV', status: 'accepted' as const },
  { id: 'd4', name: 'Бухгалтерская отчётность', size: '3.2 МБ', kind: 'PDF', status: 'review' as const },
  { id: 'd5', name: 'Договор аренды', size: '—', kind: 'PDF', status: 'missing' as const },
  { id: 'd6', name: 'Справка об оборотах', size: '0.9 МБ', kind: 'PDF', status: 'replace' as const },
  { id: 'd7', name: 'Анкета бенефициара', size: '0.3 МБ', kind: 'PDF', status: 'accepted' as const },
]

export const AUTOCHECKS = [
  {
    id: 'c1',
    title: 'Полнота данных заявки',
    fact: '100%',
    condition: '≥ 95%',
    source: 'Заявка',
    result: 'pass' as const,
    at: '10:02',
  },
  {
    id: 'c2',
    title: 'Корректность ИНН',
    fact: '7701234567',
    condition: 'checksum OK',
    source: 'Компания',
    result: 'pass' as const,
    at: '10:02',
  },
  {
    id: 'c3',
    title: 'Срок существования',
    fact: '6 лет 7 мес',
    condition: '≥ 12 мес',
    source: 'Демо-реестр',
    result: 'pass' as const,
    at: '10:02',
  },
  {
    id: 'c4',
    title: 'Соответствие продукту',
    fact: 'Оборотный',
    condition: 'product.whitelist',
    source: 'Каталог',
    result: 'pass' as const,
    at: '10:03',
  },
  {
    id: 'c5',
    title: 'Фин. история',
    fact: '6 мес',
    condition: '≥ 3 мес',
    source: 'Выписка',
    result: 'pass' as const,
    at: '10:03',
  },
  {
    id: 'c6',
    title: 'Лимит суммы',
    fact: '1.5 млн',
    condition: '≤ 5 млн',
    source: 'Политика',
    result: 'pass' as const,
    at: '10:03',
  },
  {
    id: 'c7',
    title: 'Обязательные документы',
    fact: '6/7',
    condition: '7/7',
    source: 'Документы',
    result: 'warn' as const,
    at: '10:04',
    note: '1 отсутствует · 1 на замену',
  },
  {
    id: 'c8',
    title: 'Долговая нагрузка',
    fact: '18%',
    condition: '≤ 40%',
    source: 'Финансы',
    result: 'pass' as const,
    at: '10:04',
  },
  {
    id: 'c9',
    title: 'ML-сервис',
    fact: 'OK',
    condition: 'available',
    source: 'Risk API',
    result: 'pass' as const,
    at: '10:05',
  },
]

export const RISK_SUMMARY = {
  categoryLabel: 'Умеренный · B+',
  category: 'B+',
  model: 'ML v2.3',
  pdProxy: 'Low',
  lgdProxy: '0.22',
  factorsCount: 8,
  modelDecision: 'Review',
  drivers: [
    { label: 'Выручка стабильна 6 мес.', impact: '+' as const },
    { label: 'Концентрация контрагентов 61%', impact: '−' as const },
    { label: 'Возраст выписки 12 дней', impact: '−' as const },
    { label: 'Совпадение ОКВЭД', impact: '+' as const },
    { label: 'DSCR 1.42 ≥ порога', impact: '+' as const },
    { label: 'Срок бизнеса > 5 лет', impact: '+' as const },
  ],
  sources: [
    {
      title: 'Детерминированные правила политики',
      detail: 'Лимиты, документы, срок бизнеса',
    },
    {
      title: 'ML Risk Assessment',
      detail: 'PD/LGD proxy, объяснимость',
    },
    {
      title: 'Финансовые расчёты',
      detail: 'NCF, DSCR, концентрация',
    },
    {
      title: 'AI Copilot',
      detail: 'Черновик — не решение',
    },
  ],
}

export const ATTENTION_ITEMS = [
  {
    id: 'a1',
    title: 'SLA < 4ч',
    detail: 'ABC-2026-1020 · решение не отправлено',
    tone: 'danger' as const,
    caseId: 'ABC-2026-1020',
  },
  {
    id: 'a2',
    title: 'Ответ клиента',
    detail: 'ABC-2026-1042 · загружен договор аренды',
    tone: 'ok' as const,
    caseId: 'ABC-2026-1042',
  },
  {
    id: 'a3',
    title: 'ML unavailable',
    detail: 'ABC-2026-1011 · продолжить вручную',
    tone: 'warn' as const,
    caseId: 'ABC-2026-1011',
  },
  {
    id: 'a4',
    title: 'Counteroffer истёк',
    detail: 'ABC-2026-0988 · требуется действие',
    tone: 'danger' as const,
    caseId: 'ABC-2026-0988',
  },
]

export const HISTORY_EVENTS = [
  {
    at: '24.10 09:12',
    actor: 'Предприниматель',
    badge: 'SUBMITTED',
    text: 'Заявка отправлена · DRAFT → SUBMITTED',
  },
  {
    at: '24.10 09:13',
    actor: 'System',
    badge: 'VALIDATING',
    text: 'Автоматические проверки запущены',
  },
  {
    at: '24.10 09:15',
    actor: 'System',
    badge: 'IN_REVIEW',
    text: 'Поставлена в очередь аналитика',
  },
  {
    at: '24.10 10:02',
    actor: 'Иванова А.С.',
    badge: 'ASSIGNED',
    text: 'Взята в работу',
  },
  {
    at: '24.10 11:40',
    actor: 'Иванова А.С.',
    badge: 'DOC_REQUEST',
    text: 'Запрос договора аренды · IN_REVIEW → WAITING_FOR_CLIENT',
  },
  {
    at: '24.10 14:20',
    actor: 'Предприниматель',
    badge: 'CLIENT_RESPONDED',
    text: 'Загружен договор аренды',
  },
  {
    at: '24.10 15:05',
    actor: 'System',
    badge: 'RISK_REVIEW',
    text: 'ML v2.3 пересчитал риск → B+',
  },
  {
    at: '24.10 16:30',
    actor: 'Иванова А.С.',
    badge: 'CONCLUSION',
    text: 'Черновик заключения сохранён',
  },
  {
    at: '24.10 17:00',
    actor: 'Иванова А.С.',
    badge: 'PREAPPROVED',
    text: 'Решение отправлено · DECISION_PENDING → PREAPPROVED',
  },
]

export const AGREEMENT_STEPS = [
  {
    id: 's1',
    title: 'Условия приняты клиентом',
    status: 'OFFER_ACCEPTED',
    done: true,
  },
  {
    id: 's2',
    title: 'Договор подготовлен',
    status: 'AGREEMENT_PREPARED',
    done: true,
  },
  {
    id: 's3',
    title: 'Ожидается подтверждение',
    status: 'AGREEMENT_CONFIRMED',
    done: false,
  },
  {
    id: 's4',
    title: 'Завершение заявки',
    status: 'COMPLETED',
    done: false,
  },
]

export const WORKFLOW_STAGES = [
  { key: 'intake', label: 'Intake', count: 12, sla: '4ч' },
  { key: 'docs', label: 'Документы', count: 8, sla: '24ч' },
  { key: 'checks', label: 'Проверки', count: 6, sla: '8ч' },
  { key: 'risk', label: 'Риск', count: 4, sla: '12ч' },
  { key: 'decision', label: 'Решение', count: 5, sla: '6ч' },
  { key: 'issue', label: 'Выдача', count: 3, sla: '48ч' },
]
