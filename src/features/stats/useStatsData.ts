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
  buildPointsStats,
  buildRuleViolationTrend,
  type StatsRangeDays,
} from '@/features/stats/statsLogic'
import { isDemoMode } from '@/lib/firebase/config'

export type StatsBundle = {
  rangeDays: StatsRangeDays
  setRangeDays: (days: StatsRangeDays) => void
  mineOnly: boolean
  setMineOnly: (value: boolean) => void
  loading: boolean
  habitStats: ReturnType<typeof buildHabitStats>
  pointsStats: ReturnType<typeof buildPointsStats>
  catalogBreakdown: ReturnType<typeof buildCatalogBreakdown>
  journalStats: ReturnType<typeof buildJournalStats>
  journalStreak: number
  ruleViolationTrend: ReturnType<typeof buildRuleViolationTrend>
  refresh: () => Promise<void>
}

export function useStatsData(
  relationshipId: string | undefined,
  userId: string | undefined,
): StatsBundle {
  const [rangeDays, setRangeDays] = useState<StatsRangeDays>(30)
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

  return {
    rangeDays,
    setRangeDays,
    mineOnly,
    setMineOnly,
    loading,
    habitStats,
    pointsStats,
    catalogBreakdown,
    journalStats,
    journalStreak,
    ruleViolationTrend,
    refresh,
  }
}
