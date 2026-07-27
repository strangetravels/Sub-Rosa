import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from '@/components/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { signUp } from '@/features/auth/authService'
import {
  createRelationship,
  setActiveRelationshipId,
} from '@/features/relationships/relationshipService'

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <RelationshipProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<div>Home outlet</div>} />
            </Route>
          </Routes>
        </RelationshipProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('renders navigation and relationship switcher', async () => {
    const user = userEvent.setup()
    const profile = await signUp('shell@example.com', 'secret123', 'Shell User')
    const { relationship: first } = await createRelationship({
      user: profile,
      name: 'Alpha',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    const { relationship: second } = await createRelationship({
      user: profile,
      name: 'Beta',
      role: 'switch',
      passphrase: 'encrypt-me-please',
    })
    await setActiveRelationshipId(profile.id, second.id)

    renderShell()

    expect(await screen.findByText('Shell User')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()

    const switcher = await screen.findByLabelText('Relationship')
    expect(switcher).toHaveValue(second.id)

    await user.selectOptions(switcher, first.id)
    expect(switcher).toHaveValue(first.id)
  })
})
