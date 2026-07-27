import { describe, expect, it } from 'vitest'
import {
  applyDiscreetMode,
  clearPasscode,
  clearSessionUnlock,
  getSecuritySettings,
  isSessionUnlocked,
  markSessionUnlocked,
  setPasscode,
  shouldLockApp,
  updateSecuritySettings,
  validatePasscodeFormat,
  verifyPasscode,
  APP_NAME,
  DISCREET_APP_NAME,
} from '@/features/security/securitySettings'
import { applyThemeToDocument, isThemeId } from '@/features/security/themes'

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

  it('persists theme and discreet mode', () => {
    const userId = 'user_sec_2'
    updateSecuritySettings(userId, { themeId: 'forest', discreetMode: true })
    const settings = getSecuritySettings(userId)
    expect(settings.themeId).toBe('forest')
    expect(settings.discreetMode).toBe(true)
    expect(isThemeId('forest')).toBe(true)
    expect(isThemeId('neon')).toBe(false)

    applyThemeToDocument('slate')
    expect(document.documentElement.dataset.theme).toBe('slate')

    applyDiscreetMode(true)
    expect(document.title).toBe(DISCREET_APP_NAME)
    applyDiscreetMode(false)
    expect(document.title).toBe(APP_NAME)
  })
})
