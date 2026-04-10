export const TWO_FACTOR_SETTINGS_KEY = 'althea.backoffice.2fa.settings'
export const TWO_FACTOR_PENDING_KEY = 'althea.backoffice.2fa.pending'
export const TWO_FACTOR_VERIFIED_AT_KEY = 'althea.backoffice.2fa.verified-at'

export type TwoFactorSettings = {
  enabled: boolean
  secret: string
}

export function loadTwoFactorSettings(): TwoFactorSettings {
  if (typeof window === 'undefined') {
    return { enabled: false, secret: '' }
  }

  const raw = window.localStorage.getItem(TWO_FACTOR_SETTINGS_KEY)
  if (!raw) {
    return { enabled: false, secret: '' }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TwoFactorSettings>
    return {
      enabled: Boolean(parsed.enabled),
      secret: typeof parsed.secret === 'string' ? parsed.secret : '',
    }
  } catch {
    return { enabled: false, secret: '' }
  }
}

export function saveTwoFactorSettings(settings: TwoFactorSettings): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TWO_FACTOR_SETTINGS_KEY, JSON.stringify(settings))
}

export function generateTwoFactorSecret(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let secret = ''
  for (let index = 0; index < 16; index += 1) {
    secret += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return secret
}

export function getCurrentTotpCode(secret: string): string {
  const counter = Math.floor(Date.now() / 30000)
  const input = `${secret}:${counter}`
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000000
  }

  return String(Math.abs(hash)).padStart(6, '0')
}
