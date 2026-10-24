export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 256

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Пароль не менее ${PASSWORD_MIN} символов`
  }
  if (password.length > PASSWORD_MAX) {
    return `Пароль не длиннее ${PASSWORD_MAX} символов`
  }
  return null
}

export function validatePasswordPair(password: string, confirm: string): string | null {
  const base = validatePassword(password)
  if (base) return base
  if (password !== confirm) return 'Пароли не совпадают'
  return null
}
