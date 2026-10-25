export type AnalystCaseStatus =
  | 'IN_REVIEW'
  | 'RISK_REVIEW'
  | 'DECISION_PENDING'
  | 'WAITING_FOR_CLIENT'
  | 'COUNTEROFFERED'
  | 'SUBMITTED'
  | 'DOCS_REQUESTED'

export type AnalystCase = {
  id: string
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

export const DEFAULT_CASE_ID = 'ABC-2026-1042'

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
  { key: 'ai', label: 'AI Copilot' },
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
  { id: 'd1', name: 'Паспорт руководителя', size: '1.2 МБ', kind: 'PDF', status: 'accepted' as const },
  { id: 'd2', name: 'Выписка ЕГРЮЛ', size: '340 КБ', kind: 'PDF', status: 'accepted' as const },
  { id: 'd3', name: 'Выписка по счёту 6 мес.', size: '2.4 МБ', kind: 'CSV', status: 'accepted' as const },
  { id: 'd4', name: 'Анкета бенефициара', size: '890 КБ', kind: 'PDF', status: 'accepted' as const },
  { id: 'd5', name: 'Бухгалтерская отчётность', size: '1.1 МБ', kind: 'PDF', status: 'review' as const },
  { id: 'd6', name: 'Договор аренды', size: '—', kind: 'PDF', status: 'missing' as const },
  { id: 'd7', name: 'Справка об оборотах', size: '640 КБ', kind: 'PDF', status: 'replace' as const },
]

export const AUTOCHECKS = [
  { id: 'c1', title: 'ИНН / ОГРН совпадают с реестром', result: 'pass' as const },
  { id: 'c2', title: 'Санкционные списки', result: 'pass' as const },
  { id: 'c3', title: 'Массовый адрес регистрации', result: 'pass' as const },
  { id: 'c4', title: 'Аффилированность учредителей', result: 'pass' as const },
  { id: 'c5', title: 'Негатив в открытых источниках', result: 'pass' as const },
  { id: 'c6', title: 'Стабильность выручки (6 мес.)', result: 'pass' as const },
  { id: 'c7', title: 'Кассовые разрывы > 14 дней', result: 'warn' as const, note: '2 эпизода в августе' },
  { id: 'c8', title: 'Соответствие ОКВЭД продукту', result: 'pass' as const },
  { id: 'c9', title: 'Лимит по политике CP-2026.10', result: 'pass' as const },
]

export const RISK_SUMMARY = {
  category: 'B+',
  pdProxy: 'Low',
  model: 'v2.3',
  drivers: [
    { label: 'DSCR', impact: '+', detail: '1.42 выше порога 1.2' },
    { label: 'Долговая нагрузка', impact: '+', detail: '18% в зелёной зоне' },
    { label: 'Кассовые разрывы', impact: '−', detail: '2 коротких эпизода' },
    { label: 'Срок бизнеса', impact: '+', detail: '> 5 лет' },
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
  { at: '25.10.2026 14:12', actor: 'Система', text: 'Автопроверки завершены: 8 pass · 1 warn' },
  { at: '25.10.2026 11:40', actor: 'Иванова А.С.', text: 'Заявка взята в работу' },
  { at: '24.10.2026 18:05', actor: 'Клиент', text: 'Загружена выписка по счёту 6 мес.' },
  { at: '24.10.2026 16:20', actor: 'Система', text: 'Статус → IN_REVIEW' },
  { at: '24.10.2026 15:55', actor: 'Клиент', text: 'Заявка отправлена' },
]

export const WORKFLOW_STAGES = [
  { key: 'intake', label: 'Intake', count: 12, sla: '4ч' },
  { key: 'docs', label: 'Документы', count: 8, sla: '24ч' },
  { key: 'checks', label: 'Проверки', count: 6, sla: '8ч' },
  { key: 'risk', label: 'Риск', count: 4, sla: '12ч' },
  { key: 'decision', label: 'Решение', count: 5, sla: '6ч' },
  { key: 'issue', label: 'Выдача', count: 3, sla: '48ч' },
]
