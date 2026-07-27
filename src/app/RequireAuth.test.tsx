import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RequireAuth, RequireRelationship } from '@/app/RequireAuth'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

function renderGuardedApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <RelationshipProvider>
          <Routes>
            <Route path="/auth" element={<div>Auth screen</div>} />
            <Route path="/onboarding" element={<div>Onboarding screen</div>} />
            <Route element={<RequireAuth />}>
              <Route element={<RequireRelationship />}>
                <Route path="/" element={<div>Protected home</div>} />
                <Route path="/settings" element={<div>Settings screen</div>} />
              </Route>
            </Route>
          </Routes>
        </RelationshipProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function AuthProbe() {
  const auth = useAuth()
  return (
    <div>
      <p>{auth.user ? auth.user.displayName : 'signed-out'}</p>
      <button
        type="button"
        onClick={() => {
          void auth.signUp('ctx@example.com', 'secret123', 'Context User')
        }}
      >
        Sign up
      </button>
    </div>
  )
}

describe('RequireAuth / RequireRelationship', () => {
  it('redirects anonymous users to /auth', async () => {
    renderGuardedApp('/settings')
    expect(await screen.findByText('Auth screen')).toBeInTheDocument()
  })

  it('redirects signed-in users without a relationship to onboarding', async () => {
    await signUp('alone@example.com', 'secret123', 'Alone')
    renderGuardedApp('/settings')
    expect(await screen.findByText('Onboarding screen')).toBeInTheDocument()
  })

  it('allows access once the user has a relationship', async () => {
    const user = await signUp('paired@example.com', 'secret123', 'Paired')
    await createRelationship({
      user,
      name: 'Ready',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    renderGuardedApp('/settings')
    expect(await screen.findByText('Settings screen')).toBeInTheDocument()
  })
})

describe('AuthProvider', () => {
  it('exposes sign-up through context', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('signed-out')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign up' }))
    await waitFor(() => {
      expect(screen.getByText('Context User')).toBeInTheDocument()
    })
  })
})
