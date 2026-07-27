import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { RewardsPage } from '@/features/rewards/RewardsPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

describe('RewardsPage', () => {
  it('creates a reward and manually applies it', async () => {
    const user = userEvent.setup()
    const profile = await signUp('rewardspage@example.com', 'secret123', 'Rewards Page')
    await createRelationship({
      user: profile,
      name: 'Rewards Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <RewardsPage />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Build libraries, manually apply outcomes/)
    await user.type(screen.getAllByLabelText('Title')[0]!, 'Extra tea')
    await user.click(screen.getByRole('button', { name: 'Create reward' }))

    await waitFor(() => {
      expect(screen.getByText('Extra tea')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Note'), 'Well earned')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(screen.getByText(/Reward: Extra tea/)).toBeInTheDocument()
    })
  })
})
