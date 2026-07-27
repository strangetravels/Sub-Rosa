import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  applyAppearanceForUser,
  attemptPasscode,
  clearSessionUnlock,
  getSecuritySettings,
  isSessionUnlocked,
  markSessionUnlocked,
  shouldLockApp,
  updateSecuritySettings,
  type AutoLockMinutes,
  type DeviceSecuritySettings,
  type UnlockAttemptResult,
} from '@/features/security/securitySettings'
import type { ThemeId } from '@/features/security/themes'
import { PasscodeGate } from '@/features/security/PasscodeGate'

type SecurityContextValue = {
  settings: DeviceSecuritySettings | null
  locked: boolean
  refreshSettings: () => void
  unlockWithPasscode: (pin: string) => Promise<UnlockAttemptResult>
  lockNow: () => void
  setThemeId: (themeId: ThemeId) => void
  setDiscreetMode: (enabled: boolean) => void
  setAutoLockMinutes: (minutes: AutoLockMinutes) => void
  setJournalPasscodeLock: (enabled: boolean) => void
  /** Re-verify passcode for journal secondary lock. */
  confirmPasscode: (pin: string) => Promise<UnlockAttemptResult>
}

const SecurityContext = createContext<SecurityContextValue | null>(null)

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<DeviceSecuritySettings | null>(null)
  const [locked, setLocked] = useState(false)

  const refreshSettings = useCallback(() => {
    if (!user) {
      setSettings(null)
      setLocked(false)
      applyAppearanceForUser(null)
      return
    }
    const next = getSecuritySettings(user.id)
    setSettings(next)
    applyAppearanceForUser(user.id)
    setLocked(shouldLockApp(user.id))
  }, [user])

  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  // Auto-lock on inactivity / tab hide
  useEffect(() => {
    if (!user || !settings?.passcodeEnabled) return

    let lastActivity = Date.now()

    const bump = () => {
      lastActivity = Date.now()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearSessionUnlock(user.id)
        setLocked(true)
      }
    }

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'mousemove',
      'touchstart',
      'scroll',
    ]
    for (const event of events) window.addEventListener(event, bump, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    const interval = window.setInterval(() => {
      if (!isSessionUnlocked(user.id)) {
        setLocked(true)
        return
      }
      const minutes = settings.autoLockMinutes
      if (minutes <= 0) return
      const idleMs = Date.now() - lastActivity
      if (idleMs >= minutes * 60_000) {
        clearSessionUnlock(user.id)
        setLocked(true)
      }
    }, 15_000)

    return () => {
      for (const event of events) window.removeEventListener(event, bump)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [user, settings?.passcodeEnabled, settings?.autoLockMinutes])

  const unlockWithPasscode = useCallback(
    async (pin: string): Promise<UnlockAttemptResult> => {
      if (!user) {
        return { ok: false, reason: 'disabled', message: 'Not signed in.' }
      }
      const result = await attemptPasscode(user.id, pin)
      if (!result.ok) return result
      markSessionUnlocked(user.id)
      setLocked(false)
      return result
    },
    [user],
  )

  const lockNow = useCallback(() => {
    if (!user) return
    clearSessionUnlock(user.id)
    setLocked(true)
  }, [user])

  const setThemeId = useCallback(
    (themeId: ThemeId) => {
      if (!user) return
      setSettings(updateSecuritySettings(user.id, { themeId }))
    },
    [user],
  )

  const setDiscreetMode = useCallback(
    (enabled: boolean) => {
      if (!user) return
      setSettings(updateSecuritySettings(user.id, { discreetMode: enabled }))
    },
    [user],
  )

  const setAutoLockMinutes = useCallback(
    (minutes: AutoLockMinutes) => {
      if (!user) return
      setSettings(updateSecuritySettings(user.id, { autoLockMinutes: minutes }))
    },
    [user],
  )

  const setJournalPasscodeLock = useCallback(
    (enabled: boolean) => {
      if (!user) return
      setSettings(updateSecuritySettings(user.id, { journalPasscodeLock: enabled }))
    },
    [user],
  )

  const confirmPasscode = useCallback(
    async (pin: string): Promise<UnlockAttemptResult> => {
      if (!user) {
        return { ok: false, reason: 'disabled', message: 'Not signed in.' }
      }
      return attemptPasscode(user.id, pin)
    },
    [user],
  )

  const value = useMemo<SecurityContextValue>(
    () => ({
      settings,
      locked,
      refreshSettings,
      unlockWithPasscode,
      lockNow,
      setThemeId,
      setDiscreetMode,
      setAutoLockMinutes,
      setJournalPasscodeLock,
      confirmPasscode,
    }),
    [
      settings,
      locked,
      refreshSettings,
      unlockWithPasscode,
      lockNow,
      setThemeId,
      setDiscreetMode,
      setAutoLockMinutes,
      setJournalPasscodeLock,
      confirmPasscode,
    ],
  )

  return (
    <SecurityContext.Provider value={value}>
      {children}
      {user && locked ? (
        <PasscodeGate
          appName={settings?.discreetMode ? 'Notes' : 'Sub Rosa'}
          onUnlock={unlockWithPasscode}
        />
      ) : null}
    </SecurityContext.Provider>
  )
}

export function useSecurity(): SecurityContextValue {
  const ctx = useContext(SecurityContext)
  if (!ctx) throw new Error('useSecurity must be used within SecurityProvider')
  return ctx
}
