/** localStorage key for last opened analyst case (UUID only). */
export const ANALYST_LAST_CASE_KEY = 'alfa_analyst_last_case'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only real application UUIDs are persisted — never demo ABC-… numbers. */
export function isAnalystCaseUuid(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id.trim()))
}

export function readLastAnalystCaseId(): string {
  try {
    const raw = localStorage.getItem(ANALYST_LAST_CASE_KEY)?.trim() ?? ''
    if (isAnalystCaseUuid(raw)) return raw
    if (raw) localStorage.removeItem(ANALYST_LAST_CASE_KEY)
  } catch {
    /* ignore */
  }
  return ''
}

export function writeLastAnalystCaseId(id: string): void {
  if (!isAnalystCaseUuid(id)) return
  try {
    localStorage.setItem(ANALYST_LAST_CASE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function clearLastAnalystCaseId(): void {
  try {
    localStorage.removeItem(ANALYST_LAST_CASE_KEY)
  } catch {
    /* ignore */
  }
}
