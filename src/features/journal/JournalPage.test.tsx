import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { SecurityProvider } from '@/features/security/SecurityProvider'
import { JournalPage } from '@/features/journal/JournalPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

function renderJournal() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SecurityProvider>
          <RelationshipProvider>
            <JournalPage />
          </RelationshipProvider>
        </SecurityProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('JournalPage', () => {
  it('creates a journal entry and displays it', async () => {
    const u = userEvent.setup()
    const profile = await signUp('journalui@example.com', 'secret123', 'JUI')
    await createRelationship({
      user: profile,
      name: 'Journal Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    renderJournal()

    await u.click(await screen.findByRole('button', { name: /New entry/i }))
    await u.type(screen.getByLabelText('Title'), 'First thoughts')
    await u.type(screen.getByLabelText('Body'), 'Today was meaningful.')
    await u.click(screen.getByRole('button', { name: /Save entry/i }))

    await waitFor(() => {
      expect(screen.getByText('First thoughts')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Today was meaningful.').length).toBeGreaterThan(0)
  })

  it('creates a custom prompt and uses it', async () => {
    const u = userEvent.setup()
    const profile = await signUp('journalprompt@example.com', 'secret123', 'JPrompt')
    await createRelationship({
      user: profile,
      name: 'Prompt Dynamic',
      role: 'submissive',
      passphrase: 'encrypt-me-please',
    })

    renderJournal()

    await u.click(await screen.findByRole('button', { name: /Add prompt/i }))
    await u.type(screen.getByLabelText('Prompt text'), 'What made you smile?')
    await u.type(screen.getByLabelText('Category'), 'Joy')
    await u.click(screen.getByRole('button', { name: /Save prompt/i }))

    await waitFor(() => {
      expect(screen.getByText('What made you smile?')).toBeInTheDocument()
    })
  })
})
