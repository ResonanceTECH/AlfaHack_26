/** Pull a 6-digit OTP from typed/pasted text ("123 456", "код: 123456", etc.). */
export function normalizeOtpCode(raw: string, maxLen = 6): string {
  const digits = (raw || '').replace(/\D/g, '')
  return digits.slice(0, maxLen)
}

export function isCompleteOtp(code: string, len = 6): boolean {
  return /^\d+$/.test(code) && code.length === len
}
