export type AppDocStatus = 'uploaded' | 'needed' | 'review' | 'optional'

export type AppDocSlot = {
  id: string
  title: string
  hint: string
  required: boolean
  status: AppDocStatus
  fileName?: string
  fileSizeLabel?: string
}

const KEY = 'alfa_app_documents'

const DEFAULT_SLOTS: Omit<AppDocSlot, 'status' | 'fileName' | 'fileSizeLabel'>[] = [
  {
    id: 'statement',
    title: 'Выписка по расчётному счёту',
    hint: 'PDF / XML, 6–12 месяцев',
    required: true,
  },
  {
    id: 'passport',
    title: 'Паспорт ИП / руководителя',
    hint: 'Скан разворота + регистрация',
    required: true,
  },
  {
    id: 'equipment',
    title: 'Договор / КП на оборудование',
    hint: 'Обоснование цели — PDF',
    required: true,
  },
  {
    id: 'tax',
    title: 'Налоговая декларация / УСН',
    hint: 'Последний отчётный период',
    required: true,
  },
  {
    id: 'bki',
    title: 'Согласие на запрос БКИ',
    hint: 'Подписанный скан или демо-галочка',
    required: true,
  },
  {
    id: 'collateral',
    title: 'Залог / обеспечение (если есть)',
    hint: 'Опционально',
    required: false,
  },
]

const SEED: Record<string, Partial<AppDocSlot>> = {
  statement: {
    status: 'uploaded',
    fileName: 'выписка_40702_окт2026.pdf',
    fileSizeLabel: '2.4 МБ',
  },
  passport: {
    status: 'uploaded',
    fileName: 'passport_petrov.pdf',
    fileSizeLabel: '1.1 МБ',
  },
  equipment: { status: 'needed' },
  tax: {
    status: 'review',
    fileName: 'usn_2025.pdf',
    fileSizeLabel: '0.8 МБ',
  },
  bki: { status: 'needed' },
  collateral: { status: 'optional' },
}

function readStore(): Record<string, AppDocSlot[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, AppDocSlot[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, AppDocSlot[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function defaultAppDocuments(): AppDocSlot[] {
  return DEFAULT_SLOTS.map((slot) => {
    const seed = SEED[slot.id] ?? {}
    return {
      ...slot,
      status: seed.status ?? (slot.required ? 'needed' : 'optional'),
      fileName: seed.fileName,
      fileSizeLabel: seed.fileSizeLabel,
    }
  })
}

export function loadAppDocuments(applicationId: string): AppDocSlot[] {
  const store = readStore()
  const saved = store[applicationId]
  if (saved?.length) return saved
  return defaultAppDocuments()
}

export function saveAppDocuments(applicationId: string, slots: AppDocSlot[]) {
  const store = readStore()
  store[applicationId] = slots
  writeStore(store)
}

export function formatBytesLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
