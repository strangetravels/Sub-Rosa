import { useState } from 'react'

export function PasscodeGate(props: {
  appName: string
  onUnlock: (pin: string) => Promise<boolean>
  title?: string
  subtitle?: string
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(nextPin: string) {
    setBusy(true)
    setError(null)
    try {
      const ok = await props.onUnlock(nextPin)
      if (!ok) {
        setError('Incorrect passcode.')
        setPin('')
      }
    } finally {
      setBusy(false)
    }
  }

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
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 tracking-[0.3em] text-stone-50 outline-none focus:border-rose-500"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              autoFocus
            />
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="w-full rounded-md border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-40"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}
