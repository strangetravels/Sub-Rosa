import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'

export function PartnersSettingsPage() {
  const { user, signOut } = useAuth()
  const {
    relationships,
    activeRelationship,
    setActiveRelationship,
    unlockActiveRelationship,
    deliverPendingKeys,
    getActiveSafetyNumber,
  } = useRelationship()

  const [passphrase, setPassphrase] = useState('')
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null)
  const [cryptoMessage, setCryptoMessage] = useState<string | null>(null)
  const [cryptoError, setCryptoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const myRole = activeRelationship?.members.find((m) => m.userId === user?.id)?.role
  const hasWrap = Boolean(
    user && activeRelationship?.crypto?.wrappedContentKeys[user.id],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const number = await getActiveSafetyNumber()
      if (!cancelled) setSafetyNumber(number)
    })()
    return () => {
      cancelled = true
    }
  }, [activeRelationship, getActiveSafetyNumber])

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Settings</h2>
        <p className="mt-2 text-stone-400">
          Account, partner management, encryption, and active relationship.
        </p>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Account</h3>
        <p className="mt-2 text-sm text-stone-400">
          {user?.displayName} · {user?.email}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 hover:text-stone-100"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Active relationship</h3>
        {activeRelationship ? (
          <div className="mt-3 space-y-2 text-sm text-stone-400">
            <p>
              <span className="text-stone-200">{activeRelationship.name}</span> · your role:{' '}
              {myRole}
            </p>
            <p>
              Invite code:{' '}
              <code className="rounded bg-stone-800 px-1.5 py-0.5 tracking-widest text-rose-300">
                {activeRelationship.inviteCode}
              </code>
            </p>
            <ul className="mt-2 space-y-1">
              {activeRelationship.members.map((member) => (
                <li key={member.userId}>
                  {member.displayName} ({member.role})
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No active relationship.</p>
        )}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Encryption</h3>
        <p className="mt-2 text-sm text-stone-400">
          Content keys are wrapped with your encryption passphrase (separate from login).
          {hasWrap ? ' This account has a wrapped key on file.' : ' Wrapped key not ready yet.'}
        </p>

        {safetyNumber ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">Safety number</p>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-stone-950 p-3 text-sm tracking-wider text-rose-200">
              {safetyNumber}
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Safety number appears once both partners have published identity keys.
          </p>
        )}

        <label className="mt-4 block text-sm text-stone-300">
          Unlock with passphrase
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            minLength={8}
            autoComplete="current-password"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !passphrase}
            className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 hover:text-stone-100 disabled:opacity-50"
            onClick={() => {
              setBusy(true)
              setCryptoError(null)
              setCryptoMessage(null)
              void unlockActiveRelationship(passphrase)
                .then(() => setCryptoMessage('Content key unlocked on this device.'))
                .catch((err: unknown) =>
                  setCryptoError(err instanceof Error ? err.message : 'Unlock failed.'),
                )
                .finally(() => setBusy(false))
            }}
          >
            Unlock
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 hover:text-stone-100 disabled:opacity-50"
            onClick={() => {
              setBusy(true)
              setCryptoError(null)
              setCryptoMessage(null)
              void deliverPendingKeys()
                .then(() => setCryptoMessage('Delivered pending content keys where possible.'))
                .catch((err: unknown) =>
                  setCryptoError(err instanceof Error ? err.message : 'Delivery failed.'),
                )
                .finally(() => setBusy(false))
            }}
          >
            Deliver pending keys
          </button>
        </div>

        {cryptoMessage ? <p className="mt-3 text-sm text-emerald-400">{cryptoMessage}</p> : null}
        {cryptoError ? <p className="mt-3 text-sm text-rose-400">{cryptoError}</p> : null}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">All relationships</h3>
        <ul className="mt-3 space-y-2">
          {relationships.map((rel) => (
            <li key={rel.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-stone-300">
                {rel.name}{' '}
                <span className="text-stone-500">
                  ({rel.members.length} member{rel.members.length === 1 ? '' : 's'})
                </span>
              </span>
              {rel.id === activeRelationship?.id ? (
                <span className="text-rose-400">Active</span>
              ) : (
                <button
                  type="button"
                  className="text-stone-400 hover:text-stone-200"
                  onClick={() => void setActiveRelationship(rel.id)}
                >
                  Switch
                </button>
              )}
            </li>
          ))}
        </ul>
        <NavLink
          to="/onboarding"
          className="mt-4 inline-block text-sm text-rose-400 hover:text-rose-300"
        >
          Create or join another
        </NavLink>
      </div>
    </section>
  )
}
