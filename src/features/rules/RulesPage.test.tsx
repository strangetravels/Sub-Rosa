import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { RulesPage } from '@/features/rules/RulesPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import { createRule } from '@/features/rules/ruleService'

describe('RulesPage', () => {
  it('creates a rule from the form', async () => {
    const user = userEvent.setup()
    const profile = await signUp('rulespage@example.com', 'secret123', 'Rules Page')
    await createRelationship({
      user: profile,
      name: 'Form Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <RulesPage />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Versioned rule library for Form Dynamic/)
    await user.type(screen.getByLabelText('Title'), 'Morning protocol')
    await user.type(screen.getByLabelText('Rule text'), 'Greet with respect each morning.')
    await user.click(screen.getByRole('button', { name: 'Create rule' }))

    await waitFor(() => {
      expect(screen.getAllByText('Morning protocol').length).toBeGreaterThan(0)
    })
  })

  it('shows acknowledgment prompt for submissive members', async () => {
    const dom = await signUp('rules-ack-dom@example.com', 'secret123', 'Ack Dom')
    const { relationship } = await createRelationship({
      user: dom,
      name: 'Ack Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    await createRule({
      relationshipId: relationship.id,
      title: 'Dress code',
      body: 'Follow agreed attire at home.',
      requiresAcknowledgment: true,
      createdByUserId: dom.id,
    })

    const sub = await signUp('rules-ack-sub@example.com', 'secret123', 'Ack Sub')
    const { joinRelationshipByInvite } = await import('@/features/relationships/relationshipService')
    await joinRelationshipByInvite({
      user: sub,
      inviteCode: relationship.inviteCode,
      role: 'submissive',
      passphrase: 'encrypt-me-please-b',
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <RulesPage />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/waiting for your acknowledgment/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument()
  })
})
