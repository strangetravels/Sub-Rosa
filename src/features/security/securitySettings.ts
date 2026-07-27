import { bytesToBase64, base64ToBytes } from '@/lib/crypto/encoding'
import {
  applyThemeToDocument,
  DEFAULT_THEME_ID,
  isThemeId,
  type ThemeId,
} from '@/features/security/themes'

const SETTINGS_KEY = 'subrosa.security.v1'
const UNLOCK_SESSION_KEY = 'subrosa.security.unlocked'
const ATTEMPTS_KEY = 'subrosa.security.attempts'

/** Wrong PIN attempts before a temporary lockout. */
export const MAX_PASSCODE_ATTEMPTS = 5
/** Lockout duration after too many failures (ms). */
export const PASSCODE_LOCKOUT_MS = 30_000

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

export type PasscodeAttemptState = {
  failures: number
  lockedUntil: number | null
}

export type UnlockAttemptResult =
  | { ok: true }
  | {
      ok: false
      reason: 'incorrect' | 'locked' | 'disabled'
      attemptsLeft?: number
      remainingMs?: number
      message: string
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

function attemptsStorageKey(userId: string): string {
  return `${ATTEMPTS_KEY}.${userId}`
}

export function getPasscodeAttemptState(userId: string): PasscodeAttemptState {
  try {
    const raw = sessionStorage.getItem(attemptsStorageKey(userId))
    if (!raw) return { failures: 0, lockedUntil: null }
    const parsed = JSON.parse(raw) as PasscodeAttemptState
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    }
  } catch {
    return { failures: 0, lockedUntil: null }
  }
}

function writeAttemptState(userId: string, state: PasscodeAttemptState): void {
  try {
    sessionStorage.setItem(attemptsStorageKey(userId), JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function clearPasscodeAttempts(userId: string): void {
  try {
    sessionStorage.removeItem(attemptsStorageKey(userId))
  } catch {
    // ignore
  }
}

export function getPasscodeLockRemainingMs(userId: string, now = Date.now()): number {
  const state = getPasscodeAttemptState(userId)
  if (!state.lockedUntil) return 0
  return Math.max(0, state.lockedUntil - now)
}

function recordFailedAttempt(userId: string, now = Date.now()): PasscodeAttemptState {
  const current = getPasscodeAttemptState(userId)
  const failures = current.failures + 1
  const next: PasscodeAttemptState = {
    failures,
    lockedUntil:
      failures >= MAX_PASSCODE_ATTEMPTS ? now + PASSCODE_LOCKOUT_MS : current.lockedUntil,
  }
  // After lockout window starts, reset failure count for the next window once unlocked
  if (failures >= MAX_PASSCODE_ATTEMPTS) {
    next.failures = 0
  }
  writeAttemptState(userId, next)
  return next
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
  clearPasscodeAttempts(userId)
  markSessionUnlocked(userId)
  return next
}

export async function clearPasscode(userId: string, pin: string): Promise<DeviceSecuritySettings> {
  const result = await attemptPasscode(userId, pin)
  if (!result.ok) throw new Error(result.message)
  clearSessionUnlock(userId)
  clearPasscodeAttempts(userId)
  return updateSecuritySettings(userId, {
    passcodeEnabled: false,
    passcodeHashB64: null,
    passcodeSaltB64: null,
  })
}

/** Change PIN after verifying the current one (keeps session unlocked). */
export async function changePasscode(
  userId: string,
  currentPin: string,
  nextPin: string,
): Promise<DeviceSecuritySettings> {
  const formatError = validatePasscodeFormat(nextPin)
  if (formatError) throw new Error(formatError)
  if (currentPin === nextPin) throw new Error('New passcode must be different.')

  const result = await attemptPasscode(userId, currentPin)
  if (!result.ok) throw new Error(result.message)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const passcodeHashB64 = await hashPasscode(nextPin, salt)
  const next = updateSecuritySettings(userId, {
    passcodeEnabled: true,
    passcodeHashB64,
    passcodeSaltB64: bytesToBase64(salt),
  })
  clearPasscodeAttempts(userId)
  markSessionUnlocked(userId)
  return next
}

/** Raw hash check without recording failures (tests / internal). */
export async function verifyPasscode(userId: string, pin: string): Promise<boolean> {
  const settings = getSecuritySettings(userId)
  if (!settings.passcodeEnabled || !settings.passcodeHashB64 || !settings.passcodeSaltB64) {
    return false
  }
  const salt = base64ToBytes(settings.passcodeSaltB64)
  const hash = await hashPasscode(pin, salt)
  return hash === settings.passcodeHashB64
}

/**
 * Verifies a PIN and records failed attempts / temporary lockout.
 * Successful attempts clear the failure counter.
 */
export async function attemptPasscode(
  userId: string,
  pin: string,
  now = Date.now(),
): Promise<UnlockAttemptResult> {
  const settings = getSecuritySettings(userId)
  if (!settings.passcodeEnabled) {
    return { ok: false, reason: 'disabled', message: 'Passcode is not enabled.' }
  }

  const remainingMs = getPasscodeLockRemainingMs(userId, now)
  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000)
    return {
      ok: false,
      reason: 'locked',
      remainingMs,
      message: `Too many attempts. Try again in ${seconds}s.`,
    }
  }

  // Lockout expired — clear stale lock timestamp
  const attemptState = getPasscodeAttemptState(userId)
  if (attemptState.lockedUntil && attemptState.lockedUntil <= now) {
    writeAttemptState(userId, { failures: attemptState.failures, lockedUntil: null })
  }

  const ok = await verifyPasscode(userId, pin)
  if (ok) {
    clearPasscodeAttempts(userId)
    return { ok: true }
  }

  const next = recordFailedAttempt(userId, now)
  if (next.lockedUntil && next.lockedUntil > now) {
    const seconds = Math.ceil((next.lockedUntil - now) / 1000)
    return {
      ok: false,
      reason: 'locked',
      remainingMs: next.lockedUntil - now,
      message: `Too many attempts. Try again in ${seconds}s.`,
    }
  }

  const attemptsLeft = Math.max(0, MAX_PASSCODE_ATTEMPTS - next.failures)
  return {
    ok: false,
    reason: 'incorrect',
    attemptsLeft,
    message:
      attemptsLeft > 0
        ? `Incorrect passcode. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
        : 'Incorrect passcode.',
  }
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

export const FAVICON_DEFAULT = '/favicon.svg'
export const FAVICON_DISCREET = '/favicon-discreet.svg'

export function applyDiscreetMode(enabled: boolean): void {
  if (typeof document === 'undefined') return
  document.title = enabled ? DISCREET_APP_NAME : APP_NAME
  const meta = document.querySelector('meta[name="description"]')
  if (meta) {
    meta.setAttribute('content', enabled ? DISCREET_APP_DESCRIPTION : APP_DESCRIPTION)
  }
  document.documentElement.dataset.discreet = enabled ? 'true' : 'false'

  const href = enabled ? FAVICON_DISCREET : FAVICON_DEFAULT
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = href
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
