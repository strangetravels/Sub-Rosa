import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { DashboardPage } from '@/features/relationships/DashboardPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import { createHabit } from '@/features/habits/habitService'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RelationshipProvider>
          <DashboardPage />
        </RelationshipProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('shows active relationship details and invite code when unpaired', async () => {
    const user = await signUp('dash@example.com', 'secret123', 'Dash')
    const { relationship: rel } = await createRelationship({
      user,
      name: 'Dashboard Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    renderDashboard()

    expect(await screen.findByText('Dashboard Dynamic')).toBeInTheDocument()
    expect(screen.getByText(/Your role:/)).toHaveTextContent('dominant')
    expect(screen.getByText(rel.inviteCode)).toBeInTheDocument()
    expect(screen.getByText(/Share invite code/)).toBeInTheDocument()
  })

  it('lists today’s habits and toggles completion', async () => {
    const user = userEvent.setup()
    const profile = await signUp('dashhabits@example.com', 'secret123', 'Dash Habits')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Daily Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    await createHabit({
      relationshipId: relationship.id,
      title: 'Kneel greeting',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })

    renderDashboard()

    expect(await screen.findByText('Kneel greeting')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Complete Kneel greeting/i }))
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Uncomplete Kneel greeting/i }),
      ).toBeInTheDocument()
    })
  })

  it('filters today’s list to habits assigned to me', async () => {
    const user = userEvent.setup()
    const profile = await signUp('filter-a@example.com', 'secret123', 'Filter A')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Filter Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    await createHabit({
      relationshipId: relationship.id,
      title: 'Mine only',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })
    await createHabit({
      relationshipId: relationship.id,
      title: 'Partner task',
      frequency: { type: 'daily' },
      assignedToUserId: 'other_user',
      createdByUserId: profile.id,
    })

    renderDashboard()

    expect(await screen.findByLabelText('Assigned to me')).toBeChecked()
    expect(await screen.findByText('Mine only')).toBeInTheDocument()
    expect(screen.queryByText('Partner task')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Assigned to me'))
    await waitFor(() => {
      expect(screen.getByText('Partner task')).toBeInTheDocument()
    })
  })
})
