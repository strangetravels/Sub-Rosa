import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { StatsPage } from '@/features/stats/StatsPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import { createHabit, setHabitCompletedForDate } from '@/features/habits/habitService'
import { grantPoints } from '@/features/points/pointService'
import { createJournalEntry } from '@/features/journal/journalService'
import { toLocalDateKey } from '@/lib/date'

function renderStats() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RelationshipProvider>
          <StatsPage />
        </RelationshipProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('StatsPage', () => {
  it('shows summary cards and range controls', async () => {
    const u = userEvent.setup()
    const profile = await signUp('statsui@example.com', 'secret123', 'Stats UI')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Stats Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Morning stretch',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })
    await setHabitCompletedForDate({
      habitId: habit.id,
      relationshipId: relationship.id,
      userId: profile.id,
      completedOn: toLocalDateKey(),
      completed: true,
    })
    await grantPoints({
      relationshipId: relationship.id,
      userId: profile.id,
      amount: 15,
      createdByUserId: profile.id,
    })
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: profile.id,
      visibility: 'shared',
      title: 'Check-in',
      body: 'Good day',
    })

    renderStats()

    expect(await screen.findByText('Habit rate')).toBeInTheDocument()
    expect(screen.getByText('Points net')).toBeInTheDocument()
    expect(screen.getByText('Journal streak')).toBeInTheDocument()
    expect(screen.getByText('Habit completions')).toBeInTheDocument()
    expect(screen.getByText('Points earned vs spent')).toBeInTheDocument()
    expect(screen.getByText('Per-habit breakdown')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: '7d' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '7d' })).toHaveClass('text-rose-300')
    })
    await u.click(screen.getByRole('button', { name: /^day$/i }))
    expect(screen.getByRole('button', { name: /^day$/i })).toHaveClass('text-rose-300')
  })
})
