import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { HabitsPage } from '@/features/habits/HabitsPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

describe('HabitsPage', () => {
  it('creates a habit from the form', async () => {
    const user = userEvent.setup()
    const profile = await signUp('habitspage@example.com', 'secret123', 'Habits Page')
    await createRelationship({
      user: profile,
      name: 'Form Dynamic',
      role: 'submissive',
      passphrase: 'encrypt-me-please',
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <HabitsPage />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Recurring tasks for Form Dynamic/)
    await user.type(screen.getByLabelText('Title'), 'Journal check-in')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    await waitFor(() => {
      expect(screen.getByText('Journal check-in')).toBeInTheDocument()
    })
  })
})
