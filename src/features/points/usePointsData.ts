import { useCallback, useEffect, useState } from 'react'
import {
  getPointsBalance,
  listPointsLedger,
  subscribeToDemoPoints,
} from '@/features/points/pointService'
import { isDemoMode } from '@/lib/firebase/config'
import type { PointsLedgerEntry } from '@/types/models'

export type PointsBundle = {
  balance: number
  ledger: PointsLedgerEntry[]
  loading: boolean
  refresh: () => Promise<void>
}

export function usePointsData(
  relationshipId: string | undefined,
  userId: string | undefined,
): PointsBundle {
  const [balance, setBalance] = useState(0)
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId && userId))

  const refresh = useCallback(async () => {
    if (!relationshipId || !userId) {
      setBalance(0)
      setLedger([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextBalance, nextLedger] = await Promise.all([
        getPointsBalance(relationshipId, userId),
        listPointsLedger(relationshipId),
      ])
      setBalance(nextBalance)
      setLedger(nextLedger)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoPoints(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { balance, ledger, loading, refresh }
}
