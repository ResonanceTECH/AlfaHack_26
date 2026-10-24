import axios from 'axios'

/** Axios instance pointing at /api/v1 — proxied to FastAPI (:8000). */
export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alfa_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function num(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  return String(v)
}

export function clearSession(): void {
  localStorage.removeItem('alfa_access_token')
  localStorage.removeItem('alfa_refresh_token')
  localStorage.removeItem('alfa_user')
}
