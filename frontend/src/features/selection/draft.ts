import { DEFAULT_DRAFT, type SelectionDraft } from './goalOptions'

const KEY = 'alfa_selection_draft'

export function loadSelectionDraft(companyId?: string | null): SelectionDraft {
  try {
    const raw = localStorage.getItem(companyId ? `${KEY}:${companyId}` : KEY)
    if (!raw) return { ...DEFAULT_DRAFT, lines: DEFAULT_DRAFT.lines.map((l) => ({ ...l })) }
    const parsed = JSON.parse(raw) as Partial<SelectionDraft>
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      lines: Array.isArray(parsed.lines)
        ? parsed.lines
        : DEFAULT_DRAFT.lines.map((l) => ({ ...l })),
      compareIds: Array.isArray(parsed.compareIds) ? parsed.compareIds : [],
    }
  } catch {
    return { ...DEFAULT_DRAFT, lines: DEFAULT_DRAFT.lines.map((l) => ({ ...l })) }
  }
}

export function saveSelectionDraft(draft: SelectionDraft, companyId?: string | null) {
  localStorage.setItem(companyId ? `${KEY}:${companyId}` : KEY, JSON.stringify(draft))
}
