import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSecurity } from '@/features/security/SecurityProvider'
import {
  clearPasscode,
  setPasscode,
  validatePasscodeFormat,
  type AutoLockMinutes,
} from '@/features/security/securitySettings'
import { THEMES } from '@/features/security/themes'
import { deleteAccountLocal, downloadUserDataExport } from '@/features/security/exportService'
import { isDemoMode } from '@/lib/firebase/config'

const AUTO_LOCK_OPTIONS: Array<{ value: AutoLockMinutes; label: string }> = [
  { value: 0, label: 'When tab hides only' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
]

export function SecuritySettingsPanel() {
  const { user, signOut } = useAuth()
  const {
    settings,
    locked,
    lockNow,
    refreshSettings,
    setThemeId,
    setDiscreetMode,
    setAutoLockMinutes,
    setJournalPasscodeLock,
  } = useSecurity()

  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  if (!user || !settings) return null

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-stone-200">Theme</h4>
        <p className="mt-1 text-xs text-stone-500">Applies on this device.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {THEMES.map((theme) => {
            const active = settings.themeId === theme.id
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={[
                    'w-full rounded-md border px-3 py-2 text-left text-sm',
                    active
                      ? 'border-rose-600 bg-rose-950/30 text-rose-100'
                      : 'border-stone-700 text-stone-300 hover:border-stone-500',
                  ].join(' ')}
                  onClick={() => setThemeId(theme.id)}
                >
                  <span className="font-medium">{theme.label}</span>
                  <span className="mt-0.5 block text-xs text-stone-500">{theme.description}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-stone-800 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-stone-200">Discreet mode</h4>
            <p className="mt-1 text-xs text-stone-500">
              Use a generic app name (“Notes”) in the title bar and sidebar. Reinstall the PWA
              if you also want a generic home-screen label from the install prompt.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.discreetMode}
            onChange={(e) => setDiscreetMode(e.target.checked)}
          />
        </div>
      </div>

      <div className="border-t border-stone-800 pt-6">
        <h4 className="text-sm font-medium text-stone-200">App passcode</h4>
        <p className="mt-1 text-xs text-stone-500">
          Device-local PIN lock (not your login password). Auto-locks after inactivity or when
          the tab is hidden.
        </p>

        {settings.passcodeEnabled ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-400">Passcode is enabled on this device.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={locked}
                className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 disabled:opacity-40"
                onClick={() => lockNow()}
              >
                Lock now
              </button>
            </div>
            <label className="block text-sm text-stone-300">
              Auto-lock
              <select
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm text-stone-200"
                value={settings.autoLockMinutes}
                onChange={(e) =>
                  setAutoLockMinutes(Number(e.target.value) as AutoLockMinutes)
                }
              >
                {AUTO_LOCK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-stone-200">Private journal re-lock</p>
                <p className="text-xs text-stone-500">
                  Ask for the passcode again before showing private journal entries.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.journalPasscodeLock}
                onChange={(e) => setJournalPasscodeLock(e.target.checked)}
              />
            </div>
            <label className="block text-sm text-stone-300">
              Current passcode (to disable)
              <input
                type="password"
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 tracking-[0.3em] text-stone-50"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
              />
            </label>
            <button
              type="button"
              disabled={busy || currentPin.length < 4}
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-rose-500 hover:text-rose-200 disabled:opacity-40"
              onClick={() => {
                setBusy(true)
                setError(null)
                setMessage(null)
                void clearPasscode(user.id, currentPin)
                  .then(() => {
                    setCurrentPin('')
                    setMessage('Passcode disabled.')
                    refreshSettings()
                  })
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : 'Could not disable passcode.'),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              Disable passcode
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-stone-300">
              New passcode (4–8 digits)
              <input
                type="password"
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 tracking-[0.3em] text-stone-50"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
              />
            </label>
            <label className="block text-sm text-stone-300">
              Confirm passcode
              <input
                type="password"
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 tracking-[0.3em] text-stone-50"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
              />
            </label>
            <button
              type="button"
              disabled={busy || newPin.length < 4}
              className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-40"
              onClick={() => {
                const formatError = validatePasscodeFormat(newPin)
                if (formatError) {
                  setError(formatError)
                  return
                }
                if (newPin !== confirmPin) {
                  setError('Passcodes do not match.')
                  return
                }
                setBusy(true)
                setError(null)
                setMessage(null)
                void setPasscode(user.id, newPin)
                  .then(() => {
                    setNewPin('')
                    setConfirmPin('')
                    setMessage('Passcode enabled.')
                    refreshSettings()
                  })
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : 'Could not set passcode.'),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              Enable passcode
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-stone-800 pt-6">
        <h4 className="text-sm font-medium text-stone-200">Export & delete</h4>
        <p className="mt-1 text-xs text-stone-500">
          Download a JSON copy of your relationship data
          {isDemoMode() ? ' from this browser' : ' available locally'}, or permanently delete
          your account on this device.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
            onClick={() => {
              setBusy(true)
              setError(null)
              void downloadUserDataExport(user)
                .then(() => setMessage('Export downloaded.'))
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Export failed.'),
                )
                .finally(() => setBusy(false))
            }}
          >
            Download data export
          </button>
        </div>
        <div className="mt-4 rounded-md border border-rose-900/60 bg-rose-950/20 p-3">
          <p className="text-sm text-rose-200">Delete account</p>
          <p className="mt-1 text-xs text-stone-500">
            Type DELETE to confirm. This signs you out and removes your local account data.
            Export first if you want a copy.
          </p>
          <input
            type="text"
            className="mt-2 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-1.5 text-sm text-stone-100"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <button
            type="button"
            disabled={busy || deleteConfirm !== 'DELETE'}
            className="mt-2 rounded-md border border-rose-700 px-3 py-1.5 text-sm text-rose-300 hover:border-rose-500 disabled:opacity-40"
            onClick={() => {
              setBusy(true)
              setError(null)
              void deleteAccountLocal(user)
                .then(() => signOut())
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Could not delete account.'),
                )
                .finally(() => setBusy(false))
            }}
          >
            Delete my account
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  )
}
