import { useCallback, useEffect, useState } from 'react'
import {
  ensureDefaultRewardPunishmentCategories,
  listCatalogHistory,
  listPunishments,
  listRewardPunishmentCategories,
  listRewards,
  subscribeToDemoRewards,
} from '@/features/rewards/rewardService'
import { isDemoMode } from '@/lib/firebase/config'
import type {
  CatalogHistoryEntry,
  Punishment,
  Reward,
  RewardPunishmentCategory,
} from '@/types/models'

export type RewardsBundle = {
  categories: RewardPunishmentCategory[]
  rewards: Reward[]
  punishments: Punishment[]
  history: CatalogHistoryEntry[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useRewardsData(
  relationshipId: string | undefined,
  options?: { includeArchived?: boolean },
): RewardsBundle {
  const includeArchived = options?.includeArchived ?? false
  const [categories, setCategories] = useState<RewardPunishmentCategory[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [punishments, setPunishments] = useState<Punishment[]>([])
  const [history, setHistory] = useState<CatalogHistoryEntry[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId))

  const refresh = useCallback(async () => {
    if (!relationshipId) {
      setCategories([])
      setRewards([])
      setPunishments([])
      setHistory([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const cats = await ensureDefaultRewardPunishmentCategories(relationshipId)
      const [nextRewards, nextPunishments, nextHistory] = await Promise.all([
        listRewards(relationshipId, { includeArchived }),
        listPunishments(relationshipId, { includeArchived }),
        listCatalogHistory(relationshipId),
      ])
      setCategories(cats.length ? cats : await listRewardPunishmentCategories(relationshipId))
      setRewards(nextRewards)
      setPunishments(nextPunishments)
      setHistory(nextHistory)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, includeArchived])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoRewards(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { categories, rewards, punishments, history, loading, refresh }
}
