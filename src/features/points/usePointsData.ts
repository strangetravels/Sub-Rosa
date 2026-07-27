import { useCallback, useEffect, useState } from 'react'
import {
  getPointsBalance,
  listPointsLedger,
  subscribeToDemoPoints,
} from '@/features/points/pointService'
import { isDemoMode } from '@/lib/firebase/config'
import type { PointsLedgerEntry } from '@/types/models'

export type MemberBalance = { userId: string; balance: number }

export type PointsBundle = {
  balance: number
  memberBalances: MemberBalance[]
  ledger: PointsLedgerEntry[]
  loading: boolean
  refresh: () => Promise<void>
}

export function usePointsData(
  relationshipId: string | undefined,
  userId: string | undefined,
  memberUserIds?: string[],
): PointsBundle {
  const [balance, setBalance] = useState(0)
  const [memberBalances, setMemberBalances] = useState<MemberBalance[]>([])
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId && userId))

  const refresh = useCallback(async () => {
    if (!relationshipId || !userId) {
      setBalance(0)
      setMemberBalances([])
      setLedger([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const ids = memberUserIds ?? [userId]
      const [nextLedger, ...balances] = await Promise.all([
        listPointsLedger(relationshipId),
        ...ids.map((uid) => getPointsBalance(relationshipId, uid).then((b) => ({ userId: uid, balance: b }))),
      ])
      setLedger(nextLedger)
      setMemberBalances(balances)
      const mine = balances.find((b) => b.userId === userId)
      setBalance(mine?.balance ?? 0)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, userId, memberUserIds?.join(',')])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoPoints(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { balance, memberBalances, ledger, loading, refresh }
}
