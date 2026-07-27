import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider, useRelationship } from '@/features/relationships/RelationshipProvider'
import { signUp } from '@/features/auth/authService'
import { unlockRelationshipContentKey } from '@/features/crypto/cryptoService'
import { listRelationshipsForUser } from '@/features/relationships/relationshipService'

function RelationshipProbe() {
  const {
    relationships,
    activeRelationship,
    loading,
    createRelationship,
    joinRelationship,
    setActiveRelationship,
  } = useRelationship()

  return (
    <div>
      <p>{loading ? 'loading' : 'ready'}</p>
      <p data-testid="count">{relationships.length}</p>
      <p data-testid="active">{activeRelationship?.name ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          void createRelationship('From Context', 'dominant', 'encrypt-me-please')
        }}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => {
          const code = relationships[0]?.inviteCode
          if (code) void joinRelationship(code, 'submissive', 'encrypt-me-please-b')
        }}
      >
        Rejoin
      </button>
      <button
        type="button"
        onClick={() => {
          const id = relationships[0]?.id
          if (id) void setActiveRelationship(id)
        }}
      >
        Activate first
      </button>
    </div>
  )
}

function RecoveryProbe() {
  const {
    loading,
    createRelationship,
    restoreActiveRelationshipWithRecovery,
    activeRelationship,
  } = useRelationship()
  const [phrase, setPhrase] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')

  return (
    <div>
      <p>{loading ? 'loading' : 'ready'}</p>
      <p data-testid="status">{status}</p>
      <button
        type="button"
        onClick={() => {
          void createRelationship('Recover Me', 'dominant', 'encrypt-me-please').then(
            (created) => {
              setPhrase(created.recoveryPhrase)
              setStatus('created')
            },
          )
        }}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => {
          if (!phrase || !activeRelationship) return
          void restoreActiveRelationshipWithRecovery(phrase, 'brand-new-passphrase')
            .then(async () => {
              const [rel] = await listRelationshipsForUser(activeRelationship.createdBy)
              if (!rel) throw new Error('relationship missing')
              await unlockRelationshipContentKey({
                relationship: rel,
                userId: activeRelationship.createdBy,
                passphrase: 'brand-new-passphrase',
              })
              setStatus('restored')
            })
            .catch(() => setStatus('failed'))
        }}
      >
        Restore
      </button>
    </div>
  )
}

describe('RelationshipProvider', () => {
  it('creates and tracks the active relationship', async () => {
    const user = userEvent.setup()
    await signUp('relctx@example.com', 'secret123', 'Rel Ctx')

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <RelationshipProbe />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1')
      expect(screen.getByTestId('active')).toHaveTextContent('From Context')
    })
  })

  it('restores access from a recovery phrase and persists the new wrap', async () => {
    const user = userEvent.setup()
    await signUp('recover@example.com', 'secret123', 'Recoverer')

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <RecoveryProbe />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('created')
    })

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('restored')
    })
  })
})
