import { bytesToBase64, base64ToBytes } from '@/lib/crypto/encoding'
import {
  applyThemeToDocument,
  DEFAULT_THEME_ID,
  isThemeId,
  type ThemeId,
} from '@/features/security/themes'

const SETTINGS_KEY = 'subrosa.security.v1'
const UNLOCK_SESSION_KEY = 'subrosa.security.unlocked'

export type AutoLockMinutes = 0 | 1 | 5 | 15 | 30

export type DeviceSecuritySettings = {
  userId: string
  /** SHA-256(salt || pin) as base64 when a passcode is enabled. */
  passcodeHashB64: string | null
  passcodeSaltB64: string | null
  passcodeEnabled: boolean
  /** Minutes of inactivity before re-lock. 0 = lock only when the tab hides. */
  autoLockMinutes: AutoLockMinutes
  themeId: ThemeId
  /** Generic app name / title on this device. */
  discreetMode: boolean
  /** Require passcode again to open private journal entries. */
  journalPasscodeLock: boolean
  updatedAt: string
}

const DEFAULTS: Omit<DeviceSecuritySettings, 'userId' | 'updatedAt'> = {
  passcodeHashB64: null,
  passcodeSaltB64: null,
  passcodeEnabled: false,
  autoLockMinutes: 5,
  themeId: DEFAULT_THEME_ID,
  discreetMode: false,
  journalPasscodeLock: false,
}

type SettingsStore = Record<string, DeviceSecuritySettings>

function readStore(): SettingsStore {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SettingsStore
  } catch {
    return {}
  }
}

function writeStore(store: SettingsStore): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(store))
}

export function getSecuritySettings(userId: string): DeviceSecuritySettings {
  const existing = readStore()[userId]
  if (!existing) {
    return {
      userId,
      ...DEFAULTS,
      updatedAt: new Date().toISOString(),
    }
  }
  return {
    ...DEFAULTS,
    ...existing,
    userId,
    themeId: isThemeId(existing.themeId) ? existing.themeId : DEFAULT_THEME_ID,
    autoLockMinutes: ([0, 1, 5, 15, 30] as const).includes(
      existing.autoLockMinutes as AutoLockMinutes,
    )
      ? (existing.autoLockMinutes as AutoLockMinutes)
      : 5,
  }
}

export function saveSecuritySettings(
  settings: DeviceSecuritySettings,
): DeviceSecuritySettings {
  const next: DeviceSecuritySettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  }
  const store = readStore()
  store[settings.userId] = next
  writeStore(store)
  applyAppearance(next)
  return next
}

export function updateSecuritySettings(
  userId: string,
  patch: Partial<
    Pick<
      DeviceSecuritySettings,
      | 'autoLockMinutes'
      | 'themeId'
      | 'discreetMode'
      | 'journalPasscodeLock'
      | 'passcodeEnabled'
      | 'passcodeHashB64'
      | 'passcodeSaltB64'
    >
  >,
): DeviceSecuritySettings {
  const current = getSecuritySettings(userId)
  return saveSecuritySettings({ ...current, ...patch })
}

async function hashPasscode(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder()
  const data = new Uint8Array(salt.length + enc.encode(pin).length)
  data.set(salt, 0)
  data.set(enc.encode(pin), salt.length)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToBase64(new Uint8Array(digest))
}

export function validatePasscodeFormat(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) {
    return 'Passcode must be 4–8 digits.'
  }
  return null
}

export async function setPasscode(userId: string, pin: string): Promise<DeviceSecuritySettings> {
  const formatError = validatePasscodeFormat(pin)
  if (formatError) throw new Error(formatError)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const passcodeHashB64 = await hashPasscode(pin, salt)
  const next = updateSecuritySettings(userId, {
    passcodeEnabled: true,
    passcodeHashB64,
    passcodeSaltB64: bytesToBase64(salt),
  })
  markSessionUnlocked(userId)
  return next
}

export async function clearPasscode(userId: string, pin: string): Promise<DeviceSecuritySettings> {
  const ok = await verifyPasscode(userId, pin)
  if (!ok) throw new Error('Incorrect passcode.')
  clearSessionUnlock(userId)
  return updateSecuritySettings(userId, {
    passcodeEnabled: false,
    passcodeHashB64: null,
    passcodeSaltB64: null,
  })
}

export async function verifyPasscode(userId: string, pin: string): Promise<boolean> {
  const settings = getSecuritySettings(userId)
  if (!settings.passcodeEnabled || !settings.passcodeHashB64 || !settings.passcodeSaltB64) {
    return false
  }
  const salt = base64ToBytes(settings.passcodeSaltB64)
  const hash = await hashPasscode(pin, salt)
  return hash === settings.passcodeHashB64
}

export function isSessionUnlocked(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${UNLOCK_SESSION_KEY}.${userId}`) === '1'
  } catch {
    return false
  }
}

export function markSessionUnlocked(userId: string): void {
  try {
    sessionStorage.setItem(`${UNLOCK_SESSION_KEY}.${userId}`, '1')
  } catch {
    // sessionStorage may be unavailable in some test environments
  }
}

export function clearSessionUnlock(userId: string): void {
  try {
    sessionStorage.removeItem(`${UNLOCK_SESSION_KEY}.${userId}`)
  } catch {
    // ignore
  }
}

/** True when the app should show the lock screen for this user. */
export function shouldLockApp(userId: string): boolean {
  const settings = getSecuritySettings(userId)
  if (!settings.passcodeEnabled) return false
  return !isSessionUnlocked(userId)
}

export const DISCREET_APP_NAME = 'Notes'
export const DISCREET_APP_DESCRIPTION = 'Personal notes and reminders'
export const APP_NAME = 'Sub Rosa'
export const APP_DESCRIPTION =
  'Private habit and task tracking for consensual D/s relationships'

export function applyDiscreetMode(enabled: boolean): void {
  if (typeof document === 'undefined') return
  document.title = enabled ? DISCREET_APP_NAME : APP_NAME
  const meta = document.querySelector('meta[name="description"]')
  if (meta) {
    meta.setAttribute('content', enabled ? DISCREET_APP_DESCRIPTION : APP_DESCRIPTION)
  }
  document.documentElement.dataset.discreet = enabled ? 'true' : 'false'
}

export function applyAppearance(settings: DeviceSecuritySettings): void {
  applyThemeToDocument(settings.themeId)
  applyDiscreetMode(settings.discreetMode)
}

export function applyAppearanceForUser(userId: string | null | undefined): void {
  if (!userId) {
    applyThemeToDocument(DEFAULT_THEME_ID)
    applyDiscreetMode(false)
    return
  }
  applyAppearance(getSecuritySettings(userId))
}
