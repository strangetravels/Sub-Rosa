import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { isDemoMode } from '@/lib/firebase/config'

export function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/onboarding" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName)
      } else {
        await signIn(email, password)
      }
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Sub Rosa</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h1>
      <p className="mt-2 text-sm text-stone-400">
        Email and password for v1. {isDemoMode() ? 'Demo mode is on (local persistence).' : null}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {mode === 'signup' ? (
          <label className="block text-sm text-stone-300">
            Display name
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="nickname"
            />
          </label>
        ) : null}
        <label className="block text-sm text-stone-300">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block text-sm text-stone-300">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
        >
          {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-400">
        {mode === 'signin' ? (
          <>
            No account yet?{' '}
            <button
              type="button"
              className="text-rose-400 hover:text-rose-300"
              onClick={() => setMode('signup')}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              className="text-rose-400 hover:text-rose-300"
              onClick={() => setMode('signin')}
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <p className="mt-8 text-xs text-stone-600">
        <Link to="/" className="hover:text-stone-400">
          Back
        </Link>
      </p>
    </div>
  )
}
