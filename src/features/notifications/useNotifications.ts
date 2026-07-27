import { useCallback, useEffect, useState } from 'react'
import {
  countUnreadNotifications,
  ensureDailyPromptNotification,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  runDueHabitReminders,
  subscribeToDemoNotifications,
  updateNotificationPreferences,
} from '@/features/notifications/notificationService'
import { getDailyPrompt } from '@/features/journal/journalService'
import { listHabits } from '@/features/habits/habitService'
import { isDemoMode } from '@/lib/firebase/config'
import { toLocalDateKey } from '@/lib/date'
import type { AppNotification, NotificationPreferences } from '@/types/models'

export function useNotifications(
  relationshipId: string | undefined,
  userId: string | undefined,
  options?: { runScheduler?: boolean },
) {
  const runScheduler = options?.runScheduler ?? true
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(Boolean(relationshipId && userId))

  const refresh = useCallback(async () => {
    if (!relationshipId || !userId) {
      setNotifications([])
      setPreferences(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextList, nextPrefs] = await Promise.all([
        listNotifications(relationshipId, userId),
        getNotificationPreferences(relationshipId, userId),
      ])
      setNotifications(nextList)
      setPreferences(nextPrefs)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoNotifications(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  // Daily prompt + due habit reminders once per hydrate
  useEffect(() => {
    if (!runScheduler || !relationshipId || !userId) return
    let cancelled = false
    void (async () => {
      const prompt = getDailyPrompt(toLocalDateKey())
      await ensureDailyPromptNotification({
        relationshipId,
        userId,
        promptText: prompt.text,
      })
      const habits = await listHabits(relationshipId)
      await runDueHabitReminders({ relationshipId, userId, habits })
      if (!cancelled) await refresh()
    })()
    const interval = window.setInterval(() => {
      void listHabits(relationshipId).then((habits) =>
        runDueHabitReminders({ relationshipId, userId, habits }).then(() => refresh()),
      )
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [relationshipId, userId, refresh, runScheduler])

  const unread = countUnreadNotifications(notifications)

  const markRead = useCallback(
    async (id: string) => {
      if (!relationshipId) return
      await markNotificationRead(relationshipId, id)
      await refresh()
    },
    [relationshipId, refresh],
  )

  const markAllRead = useCallback(async () => {
    if (!relationshipId || !userId) return
    await markAllNotificationsRead(relationshipId, userId)
    await refresh()
  }, [relationshipId, userId, refresh])

  const savePreferences = useCallback(
    async (patch: Parameters<typeof updateNotificationPreferences>[0]['patch']) => {
      if (!relationshipId || !userId) return
      const next = await updateNotificationPreferences({
        relationshipId,
        userId,
        patch,
      })
      setPreferences(next)
    },
    [relationshipId, userId],
  )

  return {
    notifications,
    preferences,
    loading,
    unread,
    refresh,
    markRead,
    markAllRead,
    savePreferences,
  }
}
