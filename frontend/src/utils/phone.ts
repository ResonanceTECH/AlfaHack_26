/**
 * RU mobile helpers.
 * Handles paste of "+7…", "8…", "9…", text with junk, and double country code
 * when the field already contains "+7".
 */

/** Digits only, normalized toward 7XXXXXXXXXX (may be incomplete while typing). */
export function extractRuMobileDigits(raw: string): string {
  const all = (raw || '').replace(/\D/g, '')
  if (!all) return ''

  // Full mobile anywhere in the string (paste / "тел: 8-900-…")
  const full = all.match(/(?:7|8)?(9\d{9})/)
  if (full) return `7${full[1]}`

  let d = all
  if (d.startsWith('8')) d = `7${d.slice(1)}`
  // "+7" already in field + paste "+7…" → 77…
  while (d.startsWith('77')) d = d.slice(1)
  if (d.startsWith('9')) d = `7${d}`
  if (!d.startsWith('7')) d = `7${d}`
  return d.slice(0, 11)
}

/** Display mask: +7 (999) 999-99-99 */
export function formatRuPhoneMask(input: string): string {
  const digits = extractRuMobileDigits(input)
  if (!digits || digits === '7') return '+7 '

  const rest = digits.slice(1, 11)
  let out = '+7'
  if (rest.length === 0) return `${out} `
  out += ` (${rest.slice(0, 3)}`
  if (rest.length < 3) return out
  out += ')'
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`
  return out
}

export function phoneDigits(input: string): string {
  return (input || '').replace(/\D/g, '')
}

export function isValidRuMobile(input: string): boolean {
  const d = extractRuMobileDigits(input)
  return d.length === 11 && d.startsWith('79')
}

/** E.164 for API, or null if incomplete/invalid. */
export function toE164(input: string): string | null {
  if (!isValidRuMobile(input)) return null
  return `+${extractRuMobileDigits(input)}`
}

/** True if field is empty or only the +7 prefix (optional phone). */
export function isPhoneEmpty(input: string): boolean {
  const d = extractRuMobileDigits(input)
  return !d || d === '7'
}
