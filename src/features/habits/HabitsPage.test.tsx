import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { HabitsPage } from '@/features/habits/HabitsPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  createHabit,
  setHabitCompletedForDate,
} from '@/features/habits/habitService'
import { addDays, toLocalDateKey } from '@/lib/date'

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
      expect(screen.getAllByText('Journal check-in').length).toBeGreaterThan(0)
    })
  })

  it('adds a custom category and shows completion history', async () => {
    const user = userEvent.setup()
    const profile = await signUp('historypage@example.com', 'secret123', 'History Page')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'History Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Evening report',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })
    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: profile.id,
      completedOn: toLocalDateKey(addDays(new Date(), -1)),
      completed: true,
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

    await waitFor(() => {
      expect(screen.getAllByText('Evening report').length).toBeGreaterThan(0)
    })
    await user.type(screen.getByLabelText('New category'), 'Ritual')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await waitFor(() => {
      expect(screen.getAllByText('Ritual').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('Completion history')).toBeInTheDocument()
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0)
  })
})
