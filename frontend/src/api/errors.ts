import axios from 'axios'

/** Parse FastAPI / AppError payloads: `{ detail }` or `{ error: { message } }`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined
    if (data) {
      const nested = data.error as Record<string, unknown> | undefined
      if (nested && typeof nested.message === 'string' && nested.message) return nested.message
      const detail = data.detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
      }
      if (typeof data.message === 'string' && data.message) return data.message
    }
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
