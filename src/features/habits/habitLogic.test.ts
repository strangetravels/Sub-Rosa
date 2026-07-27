import { describe, expect, it } from 'vitest'
import {
  computeStreak,
  formatFrequency,
  isHabitDueOn,
  isHabitScheduledOn,
} from '@/features/habits/habitLogic'
import { toLocalDateKey, addDays } from '@/lib/date'
import type { Habit, HabitCompletion } from '@/types/models'

function habit(partial: Partial<Habit> & Pick<Habit, 'frequency'>): Habit {
  return {
    id: 'hab_1',
    relationshipId: 'rel_1',
    title: 'Test',
    description: '',
    categoryId: null,
    assignedToUserId: 'user_1',
    createdByUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

function completion(completedOn: string, habitId = 'hab_1'): HabitCompletion {
  return {
    id: `c_${completedOn}`,
    habitId,
    relationshipId: 'rel_1',
    userId: 'user_1',
    completedOn,
    createdAt: new Date().toISOString(),
  }
}

describe('habitLogic', () => {
  it('schedules daily and weekday habits', () => {
    const monday = new Date(2026, 6, 27) // Mon
    expect(isHabitScheduledOn({ type: 'daily' }, monday)).toBe(true)
    expect(isHabitScheduledOn({ type: 'weekdays', days: [1, 3, 5] }, monday)).toBe(true)
    expect(isHabitScheduledOn({ type: 'weekdays', days: [0, 6] }, monday)).toBe(false)
  })

  it('treats weeklyCount habits as due until the weekly target is met', () => {
    const monday = new Date(2026, 6, 27)
    const h = habit({ frequency: { type: 'weeklyCount', count: 2 } })
    expect(isHabitDueOn(h, [], monday)).toBe(true)
    expect(
      isHabitDueOn(
        h,
        [completion(toLocalDateKey(monday)), completion(toLocalDateKey(addDays(monday, 1)))],
        monday,
      ),
    ).toBe(false)
  })

  it('computes daily streaks without breaking on an unfinished today', () => {
    const today = new Date(2026, 6, 27)
    const h = habit({ frequency: { type: 'daily' } })
    const completions = [
      completion(toLocalDateKey(addDays(today, -1))),
      completion(toLocalDateKey(addDays(today, -2))),
    ]
    expect(computeStreak(h, completions, today)).toBe(2)
  })

  it('formats frequencies readably', () => {
    expect(formatFrequency({ type: 'daily' })).toBe('Daily')
    expect(formatFrequency({ type: 'weeklyCount', count: 3 })).toBe('3× / week')
    expect(formatFrequency({ type: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('Weekdays')
  })
})
