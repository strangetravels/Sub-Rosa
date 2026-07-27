import { useEffect, useState } from 'react'
import type { UnlockAttemptResult } from '@/features/security/securitySettings'

export function PasscodeGate(props: {
  appName: string
  onUnlock: (pin: string) => Promise<UnlockAttemptResult>
  title?: string
  subtitle?: string
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lockRemainingMs, setLockRemainingMs] = useState(0)

  useEffect(() => {
    if (lockRemainingMs <= 0) return
    const id = window.setInterval(() => {
      setLockRemainingMs((ms) => Math.max(0, ms - 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [lockRemainingMs])

  async function submit(nextPin: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await props.onUnlock(nextPin)
      if (!result.ok) {
        setError(result.message)
        setPin('')
        if (result.reason === 'locked' && result.remainingMs) {
          setLockRemainingMs(result.remainingMs)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const lockedOut = lockRemainingMs > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/95 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Passcode lock"
    >
      <div className="w-full max-w-sm rounded-lg border border-stone-700 bg-stone-900 p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{props.appName}</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-50">
          {props.title ?? 'Enter passcode'}
        </h2>
        <p className="mt-2 text-sm text-stone-400">
          {props.subtitle ?? 'This device is locked. Enter your 4–8 digit passcode to continue.'}
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (lockedOut) return
            if (pin.length < 4) {
              setError('Passcode must be 4–8 digits.')
              return
            }
            void submit(pin)
          }}
        >
          <label className="block text-sm text-stone-300">
            Passcode
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 tracking-[0.3em] text-stone-50 outline-none focus:border-rose-500 disabled:opacity-50"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              autoFocus
              disabled={lockedOut}
            />
          </label>
          {lockedOut ? (
            <p className="text-sm text-amber-300">
              Too many attempts. Try again in {Math.ceil(lockRemainingMs / 1000)}s.
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || lockedOut || pin.length < 4}
            className="w-full rounded-md border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-40"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}
