const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase()
}

export function isValidEmail(raw: string): boolean {
  const e = normalizeEmail(raw)
  return e.length > 3 && e.length <= 255 && EMAIL_RE.test(e)
}
