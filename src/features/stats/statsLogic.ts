import {
  isHabitScheduledOn,
  weeklyCompletionCount,
} from '@/features/habits/habitLogic'
import { addDays, parseLocalDateKey, toLocalDateKey, weekKey } from '@/lib/date'
import type {
  CatalogHistoryEntry,
  Habit,
  HabitCompletion,
  JournalEntry,
  PointsLedgerEntry,
  RelationshipMember,
} from '@/types/models'

export type StatsRangeDays = 7 | 30 | 90
export type StatsGranularity = 'day' | 'week' | 'month'

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

export type HabitBreakdownRow = {
  habitId: string
  title: string
  assignedToUserId: string
  completed: number
  expected: number
  rate: number
}

export type MemberStatsRow = {
  userId: string
  displayName: string
  habitRate: number
  habitCompleted: number
  habitExpected: number
  pointsNet: number
  pointsEarned: number
  pointsSpent: number
  journalEntries: number
  journalStreak: number
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

function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function bucketKeyForDate(dateKey: string, granularity: StatsGranularity): string {
  if (granularity === 'day') return dateKey
  const date = parseLocalDateKey(dateKey)
  if (granularity === 'week') return weekKey(date)
  return monthKey(date)
}

function bucketLabel(key: string, granularity: StatsGranularity): string {
  if (granularity === 'day') {
    return parseLocalDateKey(key).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }
  if (granularity === 'week') {
    return `Week of ${parseLocalDateKey(key).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`
  }
  const [y, m] = key.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

export function rollupSeries<T extends DayBucket>(
  days: T[],
  granularity: StatsGranularity,
  merge: (acc: T | undefined, day: T, key: string, label: string) => T,
): T[] {
  if (granularity === 'day') return days
  const map = new Map<string, T>()
  const order: string[] = []
  for (const day of days) {
    const key = bucketKeyForDate(day.dateKey, granularity)
    if (!map.has(key)) order.push(key)
    const label = bucketLabel(key, granularity)
    map.set(key, merge(map.get(key), day, key, label))
  }
  return order.map((k) => map.get(k)!)
}

export function buildHabitStats(input: {
  habits: Habit[]
  completions: HabitCompletion[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): { days: HabitDayStat[]; overallRate: number; totalCompleted: number; totalExpected: number } {
  const days = enumerateDays(input.rangeDays, input.asOf)
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

export function rollupHabitDays(
  days: HabitDayStat[],
  granularity: StatsGranularity,
): HabitDayStat[] {
  return rollupSeries(days, granularity, (acc, day, key, label) => {
    const completed = (acc?.completed ?? 0) + day.completed
    const expected = (acc?.expected ?? 0) + day.expected
    return {
      dateKey: key,
      label,
      completed,
      expected,
      rate: expected === 0 ? 0 : completed / expected,
    }
  })
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

export function rollupPointsDays(
  days: PointsDayStat[],
  granularity: StatsGranularity,
): PointsDayStat[] {
  return rollupSeries(days, granularity, (acc, day, key, label) => ({
    dateKey: key,
    label,
    earned: (acc?.earned ?? 0) + day.earned,
    spent: (acc?.spent ?? 0) + day.spent,
  }))
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

export function rollupJournalDays(
  days: JournalDayStat[],
  granularity: StatsGranularity,
): JournalDayStat[] {
  return rollupSeries(days, granularity, (acc, day, key, label) => ({
    dateKey: key,
    label,
    entries: (acc?.entries ?? 0) + day.entries,
  }))
}

export function buildRuleViolationTrend(input: {
  history: CatalogHistoryEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
}): Array<DayBucket & { count: number }> {
  const days = enumerateDays(input.rangeDays, input.asOf)
  return days.map((day) => ({
    ...day,
    count: input.history.filter(
      (e) =>
        e.source === 'rule_violation' && e.appliedAt.slice(0, 10) === day.dateKey,
    ).length,
  }))
}

export function rollupRuleViolationDays(
  days: Array<DayBucket & { count: number }>,
  granularity: StatsGranularity,
): Array<DayBucket & { count: number }> {
  return rollupSeries(days, granularity, (acc, day, key, label) => ({
    dateKey: key,
    label,
    count: (acc?.count ?? 0) + day.count,
  }))
}

export function buildPerHabitBreakdown(input: {
  habits: Habit[]
  completions: HabitCompletion[]
  rangeDays: StatsRangeDays
  asOf?: Date
  userId?: string
}): HabitBreakdownRow[] {
  const days = enumerateDays(input.rangeDays, input.asOf)
  const active = input.habits.filter((h) => {
    if (h.status !== 'active') return false
    if (input.userId && h.assignedToUserId !== input.userId) return false
    return true
  })

  return active
    .map((habit) => {
      let expected = 0
      let completed = 0
      for (const day of days) {
        const date = parseLocalDateKey(day.dateKey)
        if (!isHabitScheduledOn(habit.frequency, date)) continue
        if (habit.frequency.type === 'weeklyCount') {
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
        habitId: habit.id,
        title: habit.title,
        assignedToUserId: habit.assignedToUserId,
        completed,
        expected,
        rate: expected === 0 ? 0 : completed / expected,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Compare only members of the active relationship — never arbitrary ledger user IDs.
 */
export function buildMemberComparisons(input: {
  members: RelationshipMember[]
  habits: Habit[]
  completions: HabitCompletion[]
  ledger: PointsLedgerEntry[]
  journalEntries: JournalEntry[]
  rangeDays: StatsRangeDays
  asOf?: Date
  journalStreakFor: (userId: string) => number
}): MemberStatsRow[] {
  const memberIds = new Set(input.members.map((m) => m.userId))
  return input.members.map((member) => {
    if (!memberIds.has(member.userId)) {
      // Defensive: never emit stats for non-members
      throw new Error('Member comparison restricted to relationship members.')
    }
    const habits = buildHabitStats({
      habits: input.habits,
      completions: input.completions,
      rangeDays: input.rangeDays,
      asOf: input.asOf,
      userId: member.userId,
    })
    const points = buildPointsStats({
      ledger: input.ledger,
      rangeDays: input.rangeDays,
      asOf: input.asOf,
      userId: member.userId,
    })
    const journal = buildJournalStats({
      entries: input.journalEntries,
      rangeDays: input.rangeDays,
      asOf: input.asOf,
      userId: member.userId,
    })
    return {
      userId: member.userId,
      displayName: member.displayName,
      habitRate: habits.overallRate,
      habitCompleted: habits.totalCompleted,
      habitExpected: habits.totalExpected,
      pointsNet: points.net,
      pointsEarned: points.earned,
      pointsSpent: points.spent,
      journalEntries: journal.totalEntries,
      journalStreak: input.journalStreakFor(member.userId),
    }
  })
}

export function buildStatsCsv(input: {
  habitDays: HabitDayStat[]
  pointsDays: PointsDayStat[]
  journalDays: JournalDayStat[]
  ruleDays: Array<DayBucket & { count: number }>
}): string {
  const header =
    'date,habit_completed,habit_expected,points_earned,points_spent,journal_entries,rule_violations'
  const byDate = new Map<string, {
    habit_completed: number
    habit_expected: number
    points_earned: number
    points_spent: number
    journal_entries: number
    rule_violations: number
  }>()

  for (const d of input.habitDays) {
    byDate.set(d.dateKey, {
      habit_completed: d.completed,
      habit_expected: d.expected,
      points_earned: 0,
      points_spent: 0,
      journal_entries: 0,
      rule_violations: 0,
    })
  }
  for (const d of input.pointsDays) {
    const row = byDate.get(d.dateKey) ?? {
      habit_completed: 0,
      habit_expected: 0,
      points_earned: 0,
      points_spent: 0,
      journal_entries: 0,
      rule_violations: 0,
    }
    row.points_earned = d.earned
    row.points_spent = d.spent
    byDate.set(d.dateKey, row)
  }
  for (const d of input.journalDays) {
    const row = byDate.get(d.dateKey) ?? {
      habit_completed: 0,
      habit_expected: 0,
      points_earned: 0,
      points_spent: 0,
      journal_entries: 0,
      rule_violations: 0,
    }
    row.journal_entries = d.entries
    byDate.set(d.dateKey, row)
  }
  for (const d of input.ruleDays) {
    const row = byDate.get(d.dateKey) ?? {
      habit_completed: 0,
      habit_expected: 0,
      points_earned: 0,
      points_spent: 0,
      journal_entries: 0,
      rule_violations: 0,
    }
    row.rule_violations = d.count
    byDate.set(d.dateKey, row)
  }

  const lines = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([date, r]) =>
        `${date},${r.habit_completed},${r.habit_expected},${r.points_earned},${r.points_spent},${r.journal_entries},${r.rule_violations}`,
    )
  return [header, ...lines].join('\n')
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
