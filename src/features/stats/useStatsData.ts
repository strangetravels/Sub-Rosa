import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCompletions, listHabits, subscribeToDemoHabits } from '@/features/habits/habitService'
import {
  computeJournalStreak,
  listJournalEntries,
  subscribeToDemoJournal,
} from '@/features/journal/journalService'
import { listPointsLedger, subscribeToDemoPoints } from '@/features/points/pointService'
import { listCatalogHistory, subscribeToDemoRewards } from '@/features/rewards/rewardService'
import {
  buildCatalogBreakdown,
  buildHabitStats,
  buildJournalStats,
  buildMemberComparisons,
  buildPerHabitBreakdown,
  buildPointsStats,
  buildRuleViolationTrend,
  buildStatsCsv,
  rollupHabitDays,
  rollupJournalDays,
  rollupPointsDays,
  rollupRuleViolationDays,
  type StatsGranularity,
  type StatsRangeDays,
} from '@/features/stats/statsLogic'
import { isDemoMode } from '@/lib/firebase/config'
import type { RelationshipMember } from '@/types/models'

export type StatsBundle = {
  rangeDays: StatsRangeDays
  setRangeDays: (days: StatsRangeDays) => void
  granularity: StatsGranularity
  setGranularity: (value: StatsGranularity) => void
  mineOnly: boolean
  setMineOnly: (value: boolean) => void
  loading: boolean
  habitStats: ReturnType<typeof buildHabitStats>
  habitChartDays: ReturnType<typeof rollupHabitDays>
  pointsStats: ReturnType<typeof buildPointsStats>
  pointsChartDays: ReturnType<typeof rollupPointsDays>
  catalogBreakdown: ReturnType<typeof buildCatalogBreakdown>
  journalStats: ReturnType<typeof buildJournalStats>
  journalChartDays: ReturnType<typeof rollupJournalDays>
  journalStreak: number
  ruleViolationTrend: ReturnType<typeof buildRuleViolationTrend>
  ruleChartDays: ReturnType<typeof rollupRuleViolationDays>
  perHabit: ReturnType<typeof buildPerHabitBreakdown>
  memberComparisons: ReturnType<typeof buildMemberComparisons>
  csv: string
  refresh: () => Promise<void>
}

export function useStatsData(
  relationshipId: string | undefined,
  userId: string | undefined,
  members: RelationshipMember[] = [],
): StatsBundle {
  const [rangeDays, setRangeDays] = useState<StatsRangeDays>(30)
  const [granularity, setGranularity] = useState<StatsGranularity>('day')
  const [mineOnly, setMineOnly] = useState(true)
  const [loading, setLoading] = useState(Boolean(relationshipId))
  const [habits, setHabits] = useState<Awaited<ReturnType<typeof listHabits>>>([])
  const [completions, setCompletions] = useState<Awaited<ReturnType<typeof listCompletions>>>([])
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof listPointsLedger>>>([])
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listCatalogHistory>>>([])
  const [journalEntries, setJournalEntries] = useState<
    Awaited<ReturnType<typeof listJournalEntries>>
  >([])

  const refresh = useCallback(async () => {
    if (!relationshipId || !userId) {
      setHabits([])
      setCompletions([])
      setLedger([])
      setHistory([])
      setJournalEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextHabits, nextCompletions, nextLedger, nextHistory, nextJournal] =
        await Promise.all([
          listHabits(relationshipId),
          listCompletions(relationshipId),
          listPointsLedger(relationshipId),
          listCatalogHistory(relationshipId),
          listJournalEntries(relationshipId, userId),
        ])
      setHabits(nextHabits)
      setCompletions(nextCompletions)
      setLedger(nextLedger)
      setHistory(nextHistory)
      setJournalEntries(nextJournal)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    const unsubs = [
      subscribeToDemoHabits(() => void refresh()),
      subscribeToDemoPoints(() => void refresh()),
      subscribeToDemoRewards(() => void refresh()),
      subscribeToDemoJournal(() => void refresh()),
    ]
    return () => unsubs.forEach((u) => u())
  }, [relationshipId, refresh])

  // Auto-pick a sensible default granularity when range changes
  useEffect(() => {
    if (rangeDays === 7) setGranularity('day')
    else if (rangeDays === 30) setGranularity('week')
    else setGranularity('month')
  }, [rangeDays])

  const filterUserId = mineOnly ? userId : undefined

  const habitStats = useMemo(
    () =>
      buildHabitStats({
        habits,
        completions,
        rangeDays,
        userId: filterUserId,
      }),
    [habits, completions, rangeDays, filterUserId],
  )

  const pointsStats = useMemo(
    () =>
      buildPointsStats({
        ledger,
        rangeDays,
        userId: filterUserId,
      }),
    [ledger, rangeDays, filterUserId],
  )

  const catalogBreakdown = useMemo(
    () =>
      buildCatalogBreakdown({
        history,
        rangeDays,
        userId: filterUserId,
      }),
    [history, rangeDays, filterUserId],
  )

  const journalStats = useMemo(
    () =>
      buildJournalStats({
        entries: journalEntries,
        rangeDays,
        userId: filterUserId,
      }),
    [journalEntries, rangeDays, filterUserId],
  )

  const journalStreak = useMemo(
    () => (userId ? computeJournalStreak(journalEntries, userId) : 0),
    [journalEntries, userId],
  )

  const ruleViolationTrend = useMemo(
    () => buildRuleViolationTrend({ history, rangeDays }),
    [history, rangeDays],
  )

  const habitChartDays = useMemo(
    () => rollupHabitDays(habitStats.days, granularity),
    [habitStats.days, granularity],
  )
  const pointsChartDays = useMemo(
    () => rollupPointsDays(pointsStats.days, granularity),
    [pointsStats.days, granularity],
  )
  const journalChartDays = useMemo(
    () => rollupJournalDays(journalStats.days, granularity),
    [journalStats.days, granularity],
  )
  const ruleChartDays = useMemo(
    () => rollupRuleViolationDays(ruleViolationTrend, granularity),
    [ruleViolationTrend, granularity],
  )

  const perHabit = useMemo(
    () =>
      buildPerHabitBreakdown({
        habits,
        completions,
        rangeDays,
        userId: filterUserId,
      }),
    [habits, completions, rangeDays, filterUserId],
  )

  const memberComparisons = useMemo(
    () =>
      buildMemberComparisons({
        members,
        habits,
        completions,
        ledger,
        journalEntries,
        rangeDays,
        journalStreakFor: (uid) => computeJournalStreak(journalEntries, uid),
      }),
    [members, habits, completions, ledger, journalEntries, rangeDays],
  )

  const csv = useMemo(
    () =>
      buildStatsCsv({
        habitDays: habitStats.days,
        pointsDays: pointsStats.days,
        journalDays: journalStats.days,
        ruleDays: ruleViolationTrend,
      }),
    [habitStats.days, pointsStats.days, journalStats.days, ruleViolationTrend],
  )

  return {
    rangeDays,
    setRangeDays,
    granularity,
    setGranularity,
    mineOnly,
    setMineOnly,
    loading,
    habitStats,
    habitChartDays,
    pointsStats,
    pointsChartDays,
    catalogBreakdown,
    journalStats,
    journalChartDays,
    journalStreak,
    ruleViolationTrend,
    ruleChartDays,
    perHabit,
    memberComparisons,
    csv,
    refresh,
  }
}
