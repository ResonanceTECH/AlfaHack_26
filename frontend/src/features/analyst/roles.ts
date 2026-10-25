import type { UserRole } from '@/types'

/** Банковская сторона: аналитик / legacy manager / risk */
export function isAnalystRole(role?: string | null): boolean {
  return role === 'analyst' || role === 'manager' || role === 'risk_analyst'
}

export function analystHomePath(): string {
  return '/app/analyst'
}

export const ANALYST_ROLES: UserRole[] = ['analyst', 'manager', 'risk_analyst']
