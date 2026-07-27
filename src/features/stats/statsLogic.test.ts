import { describe, expect, it } from 'vitest'
import {
  buildCatalogBreakdown,
  buildHabitStats,
  buildJournalStats,
  buildPointsStats,
  buildRuleViolationTrend,
  enumerateDays,
  formatPercent,
} from '@/features/stats/statsLogic'
import type {
  CatalogHistoryEntry,
  Habit,
  HabitCompletion,
  JournalEntry,
  PointsLedgerEntry,
} from '@/types/models'

const asOf = new Date(2026, 6, 27) // Jul 27, 2026 local

function habit(partial: Partial<Habit> & Pick<Habit, 'id'>): Habit {
  return {
    relationshipId: 'r1',
    title: 'Habit',
    description: '',
    categoryId: null,
    frequency: { type: 'daily' },
    assignedToUserId: 'u1',
    createdByUserId: 'u1',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('statsLogic', () => {
  it('enumerates the correct number of days ending at asOf', () => {
    const days = enumerateDays(7, asOf)
    expect(days).toHaveLength(7)
    expect(days[0].dateKey).toBe('2026-07-21')
    expect(days[6].dateKey).toBe('2026-07-27')
  })

  it('builds habit completion stats', () => {
    const habits = [habit({ id: 'h1' }), habit({ id: 'h2', assignedToUserId: 'u2' })]
    const completions: HabitCompletion[] = [
      {
        id: 'c1',
        habitId: 'h1',
        relationshipId: 'r1',
        userId: 'u1',
        completedOn: '2026-07-27',
        createdAt: '',
      },
    ]
    const stats = buildHabitStats({
      habits,
      completions,
      rangeDays: 7,
      asOf,
      userId: 'u1',
    })
    expect(stats.totalCompleted).toBe(1)
    expect(stats.totalExpected).toBe(7)
    expect(formatPercent(stats.overallRate)).toBe('14%')
    expect(stats.days[6].completed).toBe(1)
  })

  it('builds points earned vs spent', () => {
    const ledger: PointsLedgerEntry[] = [
      {
        id: 'p1',
        relationshipId: 'r1',
        userId: 'u1',
        amount: 10,
        source: 'habit_completion',
        note: '',
        createdAt: '2026-07-27T12:00:00.000Z',
        createdByUserId: 'u1',
      },
      {
        id: 'p2',
        relationshipId: 'r1',
        userId: 'u1',
        amount: -4,
        source: 'reward_purchase',
        note: '',
        createdAt: '2026-07-27T13:00:00.000Z',
        createdByUserId: 'u1',
      },
    ]
    const stats = buildPointsStats({ ledger, rangeDays: 7, asOf, userId: 'u1' })
    expect(stats.earned).toBe(10)
    expect(stats.spent).toBe(4)
    expect(stats.net).toBe(6)
  })

  it('builds catalog breakdown and rule violation trend', () => {
    const history: CatalogHistoryEntry[] = [
      {
        id: '1',
        relationshipId: 'r1',
        itemType: 'reward',
        itemId: 'rw',
        itemTitle: 'Treat',
        source: 'manual_reward',
        targetUserId: 'u1',
        appliedByUserId: 'u2',
        appliedAt: '2026-07-26T10:00:00.000Z',
        note: '',
      },
      {
        id: '2',
        relationshipId: 'r1',
        itemType: 'punishment',
        itemId: 'pu',
        itemTitle: 'Corner',
        source: 'rule_violation',
        targetUserId: 'u1',
        appliedByUserId: 'u2',
        appliedAt: '2026-07-27T10:00:00.000Z',
        note: '',
      },
      {
        id: '3',
        relationshipId: 'r1',
        itemType: 'punishment',
        itemId: 'pu2',
        itemTitle: 'Miss',
        source: 'habit_punishment',
        targetUserId: 'u1',
        appliedByUserId: 'u1',
        appliedAt: '2026-07-25T10:00:00.000Z',
        note: '',
      },
    ]
    const breakdown = buildCatalogBreakdown({ history, rangeDays: 7, asOf, userId: 'u1' })
    expect(breakdown.rewards).toBe(1)
    expect(breakdown.punishments).toBe(2)
    expect(breakdown.ruleViolations).toBe(1)
    expect(breakdown.habitMisses).toBe(1)

    const trend = buildRuleViolationTrend({ history, rangeDays: 7, asOf })
    expect(trend[6].count).toBe(1)
  })

  it('builds journal entry stats', () => {
    const entries: JournalEntry[] = [
      {
        id: 'j1',
        relationshipId: 'r1',
        authorUserId: 'u1',
        visibility: 'shared',
        title: 'One',
        body: '',
        tags: [],
        createdAt: '2026-07-27T09:00:00.000Z',
        updatedAt: '',
      },
      {
        id: 'j2',
        relationshipId: 'r1',
        authorUserId: 'u1',
        visibility: 'private',
        title: 'Two',
        body: '',
        tags: [],
        createdAt: '2026-07-27T18:00:00.000Z',
        updatedAt: '',
      },
    ]
    const stats = buildJournalStats({ entries, rangeDays: 7, asOf, userId: 'u1' })
    expect(stats.totalEntries).toBe(2)
    expect(stats.activeDays).toBe(1)
    expect(stats.days[6].entries).toBe(2)
  })
})
