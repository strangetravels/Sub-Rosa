import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { PointsPage } from '@/features/points/PointsPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import { createReward } from '@/features/rewards/rewardService'

describe('PointsPage', () => {
  it('grants points and purchases a priced reward', async () => {
    const user = userEvent.setup()
    const profile = await signUp('pointspage@example.com', 'secret123', 'Points Page')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Points UI Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    await createReward({
      relationshipId: relationship.id,
      title: 'Extra dessert',
      pointCost: 8,
      createdByUserId: profile.id,
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RelationshipProvider>
            <PointsPage />
          </RelationshipProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Earn points from habit completions/)
    await user.clear(screen.getByLabelText('Amount (+/-)'))
    await user.type(screen.getByLabelText('Amount (+/-)'), '20')
    await user.click(screen.getByRole('button', { name: 'Apply to ledger' }))

    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Buy' }))

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText(/Reward purchase/)).toBeInTheDocument()
    })
  })
})
