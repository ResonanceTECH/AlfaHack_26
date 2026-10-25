import type { UserRole } from '@/types'

/**
 * Backend roles: ENTREPRENEUR | ANALYST | ADMIN (lowercase on frontend).
 * `manager` / `risk_analyst` — legacy aliases → тот же кабинет /app/analyst.
 * Не путать с переключателем «показать как клиенту» — роли только из auth.
 */
export function isAnalystRole(role?: string | null): boolean {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  return r === 'analyst' || r === 'manager' || r === 'risk_analyst'
}

export function isEntrepreneurRole(role?: string | null): boolean {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  return r === 'entrepreneur' || r === 'accountant'
}

export function isAdminRole(role?: string | null): boolean {
  return String(role ?? '')
    .trim()
    .toLowerCase() === 'admin'
}

export function analystHomePath(): string {
  return '/app/analyst'
}

export const ANALYST_ROLES: UserRole[] = ['analyst', 'manager', 'risk_analyst']
