/** Контрольная сумма ИНН (как на бэке `app.core.inn`). */

function inn10Checksum(base9: string): string {
  const w = [2, 4, 10, 3, 5, 9, 4, 6, 8]
  const digits = [...base9].map(Number)
  return base9 + String(digits.reduce((s, d, i) => s + d * w[i]!, 0) % 11 % 10)
}

function inn12Checksum(base10: string): string {
  const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  const d = [...base10].map(Number)
  const n11 = d.reduce((s, x, i) => s + x * w1[i]!, 0) % 11 % 10
  const d11 = [...d, n11]
  const n12 = d11.reduce((s, x, i) => s + x * w2[i]!, 0) % 11 % 10
  return base10 + String(n11) + String(n12)
}

export function isValidInn(inn: string): boolean {
  if (!/^\d+$/.test(inn)) return false
  if (inn.length === 10) return inn10Checksum(inn.slice(0, 9)) === inn
  if (inn.length === 12) return inn12Checksum(inn.slice(0, 10)) === inn
  return false
}

export function innLegalFormHint(inn: string): 'IP' | 'OOO' | null {
  if (inn.length === 10) return 'OOO'
  if (inn.length === 12) return 'IP'
  return null
}

export function kppFromInn(inn: string): string {
  if (inn.length === 10) return `${inn.slice(0, 4)}01001`
  return '—'
}
