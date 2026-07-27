import { useCallback, useEffect, useState } from 'react'
import {
  listJournalEntries,
  listJournalPrompts,
  subscribeToDemoJournal,
} from '@/features/journal/journalService'
import { isDemoMode } from '@/lib/firebase/config'
import type { JournalEntry, JournalPrompt } from '@/types/models'

export type JournalBundle = {
  entries: JournalEntry[]
  prompts: JournalPrompt[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useJournalData(
  relationshipId: string | undefined,
  userId: string | undefined,
): JournalBundle {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [prompts, setPrompts] = useState<JournalPrompt[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId && userId))

  const refresh = useCallback(async () => {
    if (!relationshipId || !userId) {
      setEntries([])
      setPrompts([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextEntries, nextPrompts] = await Promise.all([
        listJournalEntries(relationshipId, userId),
        listJournalPrompts(relationshipId),
      ])
      setEntries(nextEntries)
      setPrompts(nextPrompts)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoJournal(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { entries, prompts, loading, refresh }
}
