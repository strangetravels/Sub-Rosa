import type { Habit, HabitCompletion, HabitFrequency } from '@/types/models'
import {
  addDays,
  parseLocalDateKey,
  toLocalDateKey,
  weekKey,
} from '@/lib/date'

export function isHabitScheduledOn(frequency: HabitFrequency, date: Date): boolean {
  if (frequency.type === 'daily') return true
  if (frequency.type === 'weekdays') return frequency.days.includes(date.getDay())
  // weeklyCount habits are always "on the board" during the week
  return true
}

export function completionsOnDate(
  completions: HabitCompletion[],
  habitId: string,
  dateKey: string,
): HabitCompletion | undefined {
  return completions.find((c) => c.habitId === habitId && c.completedOn === dateKey)
}

export function weeklyCompletionCount(
  completions: HabitCompletion[],
  habitId: string,
  date: Date,
): number {
  const start = weekKey(date)
  const endDate = addDays(parseLocalDateKey(start), 6)
  const end = toLocalDateKey(endDate)
  return completions.filter(
    (c) => c.habitId === habitId && c.completedOn >= start && c.completedOn <= end,
  ).length
}

export function isHabitDueOn(
  habit: Habit,
  completions: HabitCompletion[],
  date: Date = new Date(),
): boolean {
  if (habit.status !== 'active') return false
  if (!isHabitScheduledOn(habit.frequency, date)) return false
  if (habit.frequency.type === 'weeklyCount') {
    return weeklyCompletionCount(completions, habit.id, date) < habit.frequency.count
  }
  return true
}

/**
 * Current streak ending at `asOf` (inclusive).
 * - daily / weekdays: consecutive scheduled days completed
 * - weeklyCount: consecutive weeks meeting the target count
 */
export function computeStreak(
  habit: Habit,
  completions: HabitCompletion[],
  asOf: Date = new Date(),
): number {
  if (habit.frequency.type === 'weeklyCount') {
    let streak = 0
    let cursor = startOfWeek(asOf)
    const target = habit.frequency.count

    // If current week isn't complete yet, start from previous week when counting
    // a "current" streak that includes this week only if met.
    for (let i = 0; i < 104; i++) {
      const count = weeklyCompletionCount(completions, habit.id, cursor)
      if (count >= target) {
        streak += 1
        cursor = addDays(cursor, -7)
        continue
      }
      // Allow unfinished current week without breaking prior streak
      if (i === 0 && toLocalDateKey(cursor) === weekKey(asOf) && count < target) {
        cursor = addDays(cursor, -7)
        continue
      }
      break
    }
    return streak
  }

  let streak = 0
  let cursor = new Date(asOf)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < 400; i++) {
    if (!isHabitScheduledOn(habit.frequency, cursor)) {
      cursor = addDays(cursor, -1)
      continue
    }
    const key = toLocalDateKey(cursor)
    if (completionsOnDate(completions, habit.id, key)) {
      streak += 1
      cursor = addDays(cursor, -1)
      continue
    }
    // Today not done yet shouldn't zero a prior streak
    if (i === 0 && key === toLocalDateKey(asOf)) {
      cursor = addDays(cursor, -1)
      continue
    }
    break
  }
  return streak
}

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - next.getDay())
  return next
}

export function formatFrequency(frequency: HabitFrequency): string {
  if (frequency.type === 'daily') return 'Daily'
  if (frequency.type === 'weeklyCount') {
    return `${frequency.count}× / week`
  }
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = [...frequency.days].sort((a, b) => a - b)
  if (days.length === 7) return 'Daily'
  if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return 'Weekdays'
  return days.map((d) => labels[d]).join(', ')
}
