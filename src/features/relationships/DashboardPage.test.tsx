import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { DashboardPage } from '@/features/relationships/DashboardPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

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
    const rel = await createRelationship({
      user,
      name: 'Dashboard Dynamic',
      role: 'dominant',
    })

    renderDashboard()

    expect(await screen.findByText('Dashboard Dynamic')).toBeInTheDocument()
    expect(screen.getByText(/Your role:/)).toHaveTextContent('dominant')
    expect(screen.getByText(rel.inviteCode)).toBeInTheDocument()
    expect(screen.getByText(/Share invite code/)).toBeInTheDocument()
  })
})
