import { useCallback, useEffect, useState } from 'react'
import {
  ensureDefaultCategories,
  listCategories,
  listCompletions,
  listHabits,
  subscribeToDemoHabits,
} from '@/features/habits/habitService'
import { addDays, toLocalDateKey } from '@/lib/date'
import { isDemoMode } from '@/lib/firebase/config'
import type { Habit, HabitCategory, HabitCompletion } from '@/types/models'

export type HabitsBundle = {
  habits: Habit[]
  categories: HabitCategory[]
  completions: HabitCompletion[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useHabitsData(
  relationshipId: string | undefined,
  options?: { includeArchived?: boolean },
): HabitsBundle {
  const includeArchived = options?.includeArchived ?? false
  const [habits, setHabits] = useState<Habit[]>([])
  const [categories, setCategories] = useState<HabitCategory[]>([])
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId))

  const refresh = useCallback(async () => {
    if (!relationshipId) {
      setHabits([])
      setCategories([])
      setCompletions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const cats = await ensureDefaultCategories(relationshipId)
      const [nextHabits, nextCompletions] = await Promise.all([
        listHabits(relationshipId, { includeArchived }),
        listCompletions(relationshipId, {
          since: toLocalDateKey(addDays(new Date(), -120)),
        }),
      ])
      setCategories(cats.length ? cats : await listCategories(relationshipId))
      setHabits(nextHabits)
      setCompletions(nextCompletions)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, includeArchived])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoHabits(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { habits, categories, completions, loading, refresh }
}
