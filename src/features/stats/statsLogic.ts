import {
  isHabitScheduledOn,
  weeklyCompletionCount,
} from '@/features/habits/habitLogic'
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/lib/date'
import type {
  CatalogHistoryEntry,
  Habit,
  HabitCompletion,
  JournalEntry,
  PointsLedgerEntry,
} from '@/types/models'

export type StatsRangeDays = 7 | 30 | 90

export type DayBucket = {
  dateKey: string
  label: string
}

export type HabitDayStat = DayBucket & {
  completed: number
  expected: number
  rate: number
}

export type PointsDayStat = DayBucket & {
  earned: number
  spent: number
}

export type CatalogBreakdown = {
  rewards: number
  punishments: number
  ruleViolations: number
  habitMisses: number
}

export type JournalDayStat = DayBucket & {
  entries: number
}

export function enumerateDays(rangeDays: StatsRangeDays, asOf: Date = new Date()): DayBucket[] {
  const end = new Date(asOf)
  end.setHours(0, 0, 0, 0)
  const start = addDays(end, -(rangeDays - 1))
  const days: DayBucket[] = []
  for (let i = 0; i < rangeDays; i++) {
    const d = addDays(start, i)
    const dateKey = toLocalDateKey(d)
    days.push({
      dateKey,
      label: d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    })
  }
  return days
}

function inRange(isoOrDateKey: string, startKey: string, endKey: string): boolean {
  const key = isoOrDateKey.slice(0, 10)
  return key >= startKey && key <= endKey
}

export function buildHabitStats(input: {
  habits: Habit[]
  completions: HabitCompletion[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): { days: HabitDayStat[]; overallRate: number; totalCompleted: number; totalExpected: number } {
  const days = enumerateDays(input.rangeDays, input.asOf)
  const startKey = days[0]?.dateKey ?? ''
  const endKey = days[days.length - 1]?.dateKey ?? ''
  const active = input.habits.filter((h) => {
    if (h.status !== 'active') return false
    if (input.userId && h.assignedToUserId !== input.userId) return false
    return true
  })

  const series: HabitDayStat[] = days.map((day) => {
    const date = parseLocalDateKey(day.dateKey)
    let expected = 0
    let completed = 0
    for (const habit of active) {
      if (!isHabitScheduledOn(habit.frequency, date)) continue
      if (habit.frequency.type === 'weeklyCount') {
        // Count one expected slot per day while under weekly target (board presence).
        const weekDone = weeklyCompletionCount(input.completions, habit.id, date)
        if (weekDone >= habit.frequency.count) continue
      }
      expected += 1
      if (
        input.completions.some(
          (c) => c.habitId === habit.id && c.completedOn === day.dateKey,
        )
      ) {
        completed += 1
      }
    }
    return {
      ...day,
      completed,
      expected,
      rate: expected === 0 ? 0 : completed / expected,
    }
  })

  const totalCompleted = series.reduce((s, d) => s + d.completed, 0)
  const totalExpected = series.reduce((s, d) => s + d.expected, 0)
  return {
    days: series,
    overallRate: totalExpected === 0 ? 0 : totalCompleted / totalExpected,
    totalCompleted,
    totalExpected,
  }
}

export function buildPointsStats(input: {
  ledger: PointsLedgerEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): { days: PointsDayStat[]; earned: number; spent: number; net: number } {
  const days = enumerateDays(input.rangeDays, input.asOf)
  const startKey = days[0]?.dateKey ?? ''
  const endKey = days[days.length - 1]?.dateKey ?? ''
  const rows = input.ledger.filter((e) => {
    if (input.userId && e.userId !== input.userId) return false
    return inRange(e.createdAt, startKey, endKey)
  })

  const series: PointsDayStat[] = days.map((day) => {
    let earned = 0
    let spent = 0
    for (const entry of rows) {
      if (entry.createdAt.slice(0, 10) !== day.dateKey) continue
      if (entry.amount > 0) earned += entry.amount
      else spent += Math.abs(entry.amount)
    }
    return { ...day, earned, spent }
  })

  const earned = series.reduce((s, d) => s + d.earned, 0)
  const spent = series.reduce((s, d) => s + d.spent, 0)
  return { days: series, earned, spent, net: earned - spent }
}

export function buildCatalogBreakdown(input: {
  history: CatalogHistoryEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): CatalogBreakdown {
  const days = enumerateDays(input.rangeDays, input.asOf)
  const startKey = days[0]?.dateKey ?? ''
  const endKey = days[days.length - 1]?.dateKey ?? ''
  const rows = input.history.filter((e) => {
    if (input.userId && e.targetUserId !== input.userId) return false
    return inRange(e.appliedAt, startKey, endKey)
  })

  let rewards = 0
  let punishments = 0
  let ruleViolations = 0
  let habitMisses = 0
  for (const entry of rows) {
    if (entry.itemType === 'reward') rewards += 1
    else punishments += 1
    if (entry.source === 'rule_violation') ruleViolations += 1
    if (entry.source === 'habit_punishment') habitMisses += 1
  }
  return { rewards, punishments, ruleViolations, habitMisses }
}

export function buildJournalStats(input: {
  entries: JournalEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): { days: JournalDayStat[]; totalEntries: number; activeDays: number } {
  const days = enumerateDays(input.rangeDays, input.asOf)
  const startKey = days[0]?.dateKey ?? ''
  const endKey = days[days.length - 1]?.dateKey ?? ''
  const rows = input.entries.filter((e) => {
    if (input.userId && e.authorUserId !== input.userId) return false
    return inRange(e.createdAt, startKey, endKey)
  })

  const series: JournalDayStat[] = days.map((day) => ({
    ...day,
    entries: rows.filter((e) => e.createdAt.slice(0, 10) === day.dateKey).length,
  }))

  const totalEntries = series.reduce((s, d) => s + d.entries, 0)
  const activeDays = series.filter((d) => d.entries > 0).length
  return { days: series, totalEntries, activeDays }
}

export function buildRuleViolationTrend(input: {
  history: CatalogHistoryEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
}): DayBucket & { count: number }[] {
  const days = enumerateDays(input.rangeDays, input.asOf)
  return days.map((day) => ({
    ...day,
    count: input.history.filter(
      (e) =>
        e.source === 'rule_violation' && e.appliedAt.slice(0, 10) === day.dateKey,
    ).length,
  }))
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
