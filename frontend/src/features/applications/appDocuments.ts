export type AppDocStatus = 'uploaded' | 'needed' | 'review' | 'optional'

export type AppDocSlot = {
  id: string
  title: string
  hint: string
  required: boolean
  status: AppDocStatus
  fileName?: string
  fileSizeLabel?: string
  /** Live ApplicationDocument.id when synced from API / upload. */
  documentId?: string
}

/** Map backend document_type → checklist slot id. */
const TYPE_TO_SLOT: Record<string, string> = {
  statement: 'statement',
  bank_statement: 'statement',
  bank_statement_6m: 'statement',
  bank_statement_12m: 'statement',
  passport: 'passport',
  equipment: 'equipment',
  tax: 'tax',
  usn: 'tax',
  bki: 'bki',
  collateral: 'collateral',
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

export type LiveAppDoc = {
  id: string
  type: string
  name: string
  size: number
  status: string
}

/** Merge checklist slots with live `/applications/.../documents` rows. */
export function mergeSlotsWithLiveDocs(
  slots: AppDocSlot[],
  docs: LiveAppDoc[],
): AppDocSlot[] {
  const usable = docs.filter((d) => d.status !== 'requested' && d.id)
  if (!usable.length) return slots

  const bySlot = new Map<string, LiveAppDoc>()
  for (const d of usable) {
    const key = TYPE_TO_SLOT[d.type.toLowerCase()] || d.type.toLowerCase()
    if (!bySlot.has(key)) bySlot.set(key, d)
  }
  // filename fallback for seed names
  for (const d of usable) {
    for (const slot of slots) {
      if (slot.fileName && d.name === slot.fileName && !bySlot.has(slot.id)) {
        bySlot.set(slot.id, d)
      }
    }
  }

  return slots.map((slot) => {
    const live = bySlot.get(slot.id)
    if (!live) return slot
    const status: AppDocStatus =
      live.status === 'rejected'
        ? 'needed'
        : live.status === 'verified'
          ? 'review'
          : 'uploaded'
    return {
      ...slot,
      documentId: live.id,
      fileName: live.name || slot.fileName,
      fileSizeLabel: live.size > 0 ? formatBytesLabel(live.size) : slot.fileSizeLabel,
      status,
    }
  })
}
