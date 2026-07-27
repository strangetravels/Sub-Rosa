import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  archiveHabit,
  createCategory,
  createHabit,
  ensureDefaultCategories,
  listCategories,
  listHabits,
  setHabitCompletedForDate,
  updateHabit,
} from '@/features/habits/habitService'
import { computeStreak } from '@/features/habits/habitLogic'
import { listCompletions } from '@/features/habits/habitService'
import { toLocalDateKey, addDays } from '@/lib/date'

const PASS = 'encrypt-me-please'

describe('habitService', () => {
  it('creates habits, tracks completions, and archives', async () => {
    const user = await signUp('habits@example.com', 'secret123', 'Habit User')
    const { relationship } = await createRelationship({
      user,
      name: 'Habits Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })

    const categories = await ensureDefaultCategories(relationship.id)
    expect(categories.length).toBeGreaterThan(0)

    const custom = await createCategory({
      relationshipId: relationship.id,
      label: 'Ritual',
      color: '#2563eb',
    })
    expect(custom.label).toBe('Ritual')
    expect((await listCategories(relationship.id)).some((c) => c.id === custom.id)).toBe(true)

    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Morning stretch',
      description: '5 minutes',
      categoryId: custom.id,
      frequency: { type: 'daily' },
      assignedToUserId: user.id,
      createdByUserId: user.id,
    })

    expect(habit.title).toBe('Morning stretch')
    const listed = await listHabits(relationship.id)
    expect(listed.map((h) => h.id)).toContain(habit.id)

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: toLocalDateKey(addDays(new Date(), -1)),
      completed: true,
    })
    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completed: true,
    })

    const completions = await listCompletions(relationship.id, { habitId: habit.id })
    expect(completions).toHaveLength(2)
    expect(computeStreak(habit, completions)).toBeGreaterThanOrEqual(1)

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completed: false,
    })
    expect(
      (await listCompletions(relationship.id, { habitId: habit.id })).map((c) => c.completedOn),
    ).not.toContain(toLocalDateKey())

    const archived = await archiveHabit(relationship.id, habit.id)
    expect(archived.status).toBe('archived')
    expect(await listHabits(relationship.id)).toHaveLength(0)
    expect(await listHabits(relationship.id, { includeArchived: true })).toHaveLength(1)

    const restored = await updateHabit(relationship.id, habit.id, {
      title: 'Evening stretch',
      status: 'active',
    })
    expect(restored.title).toBe('Evening stretch')
    expect(restored.status).toBe('active')
  })

  it('rejects empty titles and empty weekday sets', async () => {
    const user = await signUp('habits2@example.com', 'secret123', 'Habit Two')
    const { relationship } = await createRelationship({
      user,
      name: 'Validation',
      role: 'switch',
      passphrase: PASS,
    })

    await expect(
      createHabit({
        relationshipId: relationship.id,
        title: '   ',
        frequency: { type: 'daily' },
        assignedToUserId: user.id,
        createdByUserId: user.id,
      }),
    ).rejects.toThrow('Title is required.')

    await expect(
      createHabit({
        relationshipId: relationship.id,
        title: 'Broken',
        frequency: { type: 'weekdays', days: [] },
        assignedToUserId: user.id,
        createdByUserId: user.id,
      }),
    ).rejects.toThrow('Pick at least one weekday.')

    await expect(
      createCategory({
        relationshipId: relationship.id,
        label: '  ',
        color: '#fff',
      }),
    ).rejects.toThrow('Category name is required.')
  })
})
