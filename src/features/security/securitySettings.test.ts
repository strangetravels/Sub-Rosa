import { describe, expect, it } from 'vitest'
import {
  applyDiscreetMode,
  attemptPasscode,
  changePasscode,
  clearPasscode,
  clearPasscodeAttempts,
  clearSessionUnlock,
  FAVICON_DEFAULT,
  FAVICON_DISCREET,
  getPasscodeLockRemainingMs,
  getSecuritySettings,
  isSessionUnlocked,
  markSessionUnlocked,
  MAX_PASSCODE_ATTEMPTS,
  setPasscode,
  shouldLockApp,
  updateSecuritySettings,
  validatePasscodeFormat,
  verifyPasscode,
  APP_NAME,
  DISCREET_APP_NAME,
} from '@/features/security/securitySettings'
import { applyThemeToDocument, isThemeId, THEMES } from '@/features/security/themes'

describe('securitySettings', () => {
  it('validates passcode format', () => {
    expect(validatePasscodeFormat('12')).toMatch(/4–8/)
    expect(validatePasscodeFormat('abcd')).toMatch(/4–8/)
    expect(validatePasscodeFormat('1234')).toBeNull()
    expect(validatePasscodeFormat('12345678')).toBeNull()
  })

  it('sets, verifies, and clears a passcode', async () => {
    const userId = 'user_sec_1'
    await setPasscode(userId, '2468')
    const settings = getSecuritySettings(userId)
    expect(settings.passcodeEnabled).toBe(true)
    expect(await verifyPasscode(userId, '2468')).toBe(true)
    expect(await verifyPasscode(userId, '0000')).toBe(false)
    expect(isSessionUnlocked(userId)).toBe(true)

    clearSessionUnlock(userId)
    expect(shouldLockApp(userId)).toBe(true)

    markSessionUnlocked(userId)
    expect(shouldLockApp(userId)).toBe(false)

    await clearPasscode(userId, '2468')
    expect(getSecuritySettings(userId).passcodeEnabled).toBe(false)
    expect(shouldLockApp(userId)).toBe(false)
  })

  it('changes passcode after verifying the current one', async () => {
    const userId = 'user_sec_change'
    await setPasscode(userId, '1111')
    await changePasscode(userId, '1111', '9999')
    expect(await verifyPasscode(userId, '1111')).toBe(false)
    expect(await verifyPasscode(userId, '9999')).toBe(true)
  })

  it('locks out after too many failed attempts', async () => {
    const userId = 'user_sec_lockout'
    await setPasscode(userId, '5555')
    clearSessionUnlock(userId)
    clearPasscodeAttempts(userId)

    for (let i = 0; i < MAX_PASSCODE_ATTEMPTS - 1; i += 1) {
      const result = await attemptPasscode(userId, '0000')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('incorrect')
    }

    const locked = await attemptPasscode(userId, '0000')
    expect(locked.ok).toBe(false)
    if (!locked.ok) {
      expect(locked.reason).toBe('locked')
      expect(locked.remainingMs).toBeGreaterThan(0)
    }
    expect(getPasscodeLockRemainingMs(userId)).toBeGreaterThan(0)

    // Correct PIN still blocked while locked out
    const blocked = await attemptPasscode(userId, '5555')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe('locked')
  })

  it('persists theme and discreet mode, including favicon swap', () => {
    const userId = 'user_sec_2'
    updateSecuritySettings(userId, { themeId: 'forest', discreetMode: true })
    const settings = getSecuritySettings(userId)
    expect(settings.themeId).toBe('forest')
    expect(settings.discreetMode).toBe(true)
    expect(isThemeId('forest')).toBe(true)
    expect(isThemeId('neon')).toBe(false)
    expect(THEMES.every((t) => t.preview.length === 3)).toBe(true)

    applyThemeToDocument('slate')
    expect(document.documentElement.dataset.theme).toBe('slate')

    applyDiscreetMode(true)
    expect(document.title).toBe(DISCREET_APP_NAME)
    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
    expect(icon?.getAttribute('href')).toBe(FAVICON_DISCREET)

    applyDiscreetMode(false)
    expect(document.title).toBe(APP_NAME)
    expect(icon?.getAttribute('href')).toBe(FAVICON_DEFAULT)
  })
})
