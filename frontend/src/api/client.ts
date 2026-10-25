import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

/** Axios instance pointing at /api/v1 — proxied to FastAPI (:8000). */
export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
})

export const ACTIVE_COMPANY_KEY = 'alfa_active_company_id'

export function clearSession(): void {
  localStorage.removeItem('alfa_access_token')
  localStorage.removeItem('alfa_refresh_token')
  localStorage.removeItem('alfa_user')
  localStorage.removeItem(ACTIVE_COMPANY_KEY)
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alfa_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('alfa_refresh_token')
  if (!refresh) return null
  try {
    // bare axios — avoid interceptor recursion
    const { data } = await axios.post(
      '/api/v1/auth/refresh',
      { refreshToken: refresh },
      { timeout: 15_000 },
    )
    const raw = data as Record<string, unknown>
    const access = String(raw.accessToken ?? raw.access_token ?? '')
    const nextRefresh = String(raw.refreshToken ?? raw.refresh_token ?? '')
    if (!access) return null
    localStorage.setItem('alfa_access_token', access)
    if (nextRefresh) localStorage.setItem('alfa_refresh_token', nextRefresh)
    return access
  } catch {
    return null
  }
}

function forceLoginRedirect() {
  clearSession()
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path.startsWith('/login') || path.startsWith('/forgot') || path.startsWith('/reset')) return
  window.location.assign(`/login?next=${encodeURIComponent(path + window.location.search)}`)
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status
    const original = error.config as RetriableConfig | undefined
    const url = original?.url ?? ''

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/password')
    ) {
      return Promise.reject(error)
    }

    original._retry = true

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }

    const access = await refreshPromise
    if (!access) {
      forceLoginRedirect()
      return Promise.reject(error)
    }

    original.headers = original.headers ?? {}
    original.headers.Authorization = `Bearer ${access}`
    return api.request(original)
  },
)

export function num(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  return String(v)
}
