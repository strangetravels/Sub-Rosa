import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import type { RelationshipRole } from '@/types/models'

const roles: { value: RelationshipRole; label: string }[] = [
  { value: 'dominant', label: 'Dominant' },
  { value: 'submissive', label: 'submissive' },
  { value: 'switch', label: 'Switch' },
]

export function OnboardingPage() {
  const { user, loading: authLoading } = useAuth()
  const { createRelationship, joinRelationship } = useRelationship()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('Our dynamic')
  const [inviteCode, setInviteCode] = useState('')
  const [role, setRole] = useState<RelationshipRole>('dominant')
  const [passphrase, setPassphrase] = useState('')
  const [passphraseConfirm, setPassphraseConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null)
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null)
  const [awaitingKeyDelivery, setAwaitingKeyDelivery] = useState(false)

  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (tab === 'create') {
        const created = await createRelationship(name, role, passphrase)
        setRecoveryPhrase(created.recoveryPhrase)
      } else {
        const joined = await joinRelationship(inviteCode, role, passphrase)
        setSafetyNumber(joined.safetyNumber)
        setAwaitingKeyDelivery(joined.awaitingKeyDelivery)
        if (!joined.awaitingKeyDelivery) {
          // brief pause so user can read safety number, then continue via button
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (recoveryPhrase) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Recovery</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
          Save your recovery phrase
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          This is the only way to regain access if you forget your encryption passphrase.
          Store it somewhere safe. If you lose both, this relationship’s encrypted history
          cannot be recovered — by anyone.
        </p>
        <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-stone-700 bg-stone-900 p-4 text-sm leading-7 text-rose-200">
          {recoveryPhrase}
        </pre>
        <button
          type="button"
          className="mt-6 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
          onClick={() => navigate('/')}
        >
          I’ve saved it — continue
        </button>
      </div>
    )
  }

  if (safetyNumber) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Verification</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
          Compare safety numbers
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          Confirm this number with your partner out-of-band (call, in person, another app).
          If it matches, the ECDH exchange wasn’t tampered with.
        </p>
        <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-stone-700 bg-stone-900 p-4 text-center text-lg tracking-wider text-rose-200">
          {safetyNumber}
        </pre>
        {awaitingKeyDelivery ? (
          <p className="mt-4 text-sm text-amber-300">
            Your partner still needs to open the app once to finish delivering the content
            key. Use Settings → Deliver pending keys on their device.
          </p>
        ) : null}
        <button
          type="button"
          className="mt-6 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
          onClick={() => navigate('/')}
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Pairing</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
        Link a relationship
      </h1>
      <p className="mt-2 text-sm text-stone-400">
        Create an invite for your partner, or join with their code. You’ll also set an
        encryption passphrase — keep it separate from your login password.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('create')}
          className={`rounded-md px-3 py-2 text-sm ${
            tab === 'create' ? 'bg-stone-800 text-rose-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setTab('join')}
          className={`rounded-md px-3 py-2 text-sm ${
            tab === 'join' ? 'bg-stone-800 text-rose-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Join with code
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {tab === 'create' ? (
          <label className="block text-sm text-stone-300">
            Relationship name
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="block text-sm text-stone-300">
            Invite code
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 uppercase tracking-widest text-stone-50 outline-none focus:border-rose-500"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
              minLength={6}
              maxLength={8}
              placeholder="ABC123"
            />
          </label>
        )}

        <label className="block text-sm text-stone-300">
          Your role in this relationship
          <select
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={role}
            onChange={(e) => setRole(e.target.value as RelationshipRole)}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-stone-300">
          Encryption passphrase
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <label className="block text-sm text-stone-300">
          Confirm passphrase
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={passphraseConfirm}
            onChange={(e) => setPassphraseConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
        >
          {submitting ? 'Working…' : tab === 'create' ? 'Create relationship' : 'Join relationship'}
        </button>
      </form>
    </div>
  )
}
