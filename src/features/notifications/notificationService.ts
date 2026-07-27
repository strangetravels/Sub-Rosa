import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { getFirebaseApp, getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import { toLocalDateKey } from '@/lib/date'
import type {
  AppNotification,
  Habit,
  HabitReminder,
  NotificationKind,
  NotificationPreferences,
  Relationship,
} from '@/types/models'

const NOTIF_CHANGED = 'subrosa-demo-notifications'

export function notifyDemoNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIF_CHANGED))
}

export function subscribeToDemoNotifications(listener: () => void): () => void {
  window.addEventListener(NOTIF_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(NOTIF_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

const DEFAULT_PREFS = {
  habitReminders: true,
  habitCompleted: true,
  habitMissed: true,
  sharedJournal: true,
  chatMessage: true,
  dailyPrompt: true,
  pushEnabled: false,
  fcmToken: null as string | null,
}

function prefsId(relationshipId: string, userId: string): string {
  return `${relationshipId}_${userId}`
}

export async function getRelationshipById(relationshipId: string): Promise<Relationship | null> {
  if (isDemoMode()) {
    return readDemoState().relationships.find((r) => r.id === relationshipId) ?? null
  }
  const db = getFirebaseDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'relationships', relationshipId))
  return snap.exists() ? (snap.data() as Relationship) : null
}

export async function getNotificationPreferences(
  relationshipId: string,
  userId: string,
): Promise<NotificationPreferences> {
  const id = prefsId(relationshipId, userId)
  if (isDemoMode()) {
    const existing = readDemoState().notificationPreferences.find((p) => p.id === id)
    if (existing) return existing
    const created: NotificationPreferences = {
      id,
      userId,
      relationshipId,
      ...DEFAULT_PREFS,
      updatedAt: new Date().toISOString(),
    }
    updateDemoState((s) => ({
      ...s,
      notificationPreferences: [...s.notificationPreferences, created],
    }))
    return created
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const ref = doc(db, 'relationships', relationshipId, 'notificationPreferences', userId)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as NotificationPreferences
  const created: NotificationPreferences = {
    id,
    userId,
    relationshipId,
    ...DEFAULT_PREFS,
    updatedAt: new Date().toISOString(),
  }
  await setDoc(ref, created)
  return created
}

export async function updateNotificationPreferences(input: {
  relationshipId: string
  userId: string
  patch: Partial<
    Pick<
      NotificationPreferences,
      | 'habitReminders'
      | 'habitCompleted'
      | 'habitMissed'
      | 'sharedJournal'
      | 'chatMessage'
      | 'dailyPrompt'
      | 'pushEnabled'
      | 'fcmToken'
    >
  >
}): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(input.relationshipId, input.userId)
  const next: NotificationPreferences = {
    ...current,
    ...input.patch,
    updatedAt: new Date().toISOString(),
  }

  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      notificationPreferences: s.notificationPreferences.map((p) =>
        p.id === current.id ? next : p,
      ),
    }))
    notifyDemoNotificationsChanged()
    return next
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'notificationPreferences', input.userId),
    next,
  )
  return next
}

function prefEnabled(prefs: NotificationPreferences, kind: NotificationKind): boolean {
  switch (kind) {
    case 'habit_reminder':
      return prefs.habitReminders
    case 'habit_completed':
      return prefs.habitCompleted
    case 'habit_missed':
      return prefs.habitMissed
    case 'shared_journal':
      return prefs.sharedJournal
    case 'chat_message':
      return prefs.chatMessage
    case 'daily_prompt':
      return prefs.dailyPrompt
    default:
      return true
  }
}

async function maybeShowBrowserNotification(n: AppNotification, pushEnabled: boolean): Promise<void> {
  if (!pushEnabled) return
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(n.title, { body: n.body, tag: n.id })
  } catch {
    // Ignore — browser may block from non-secure contexts in tests
  }
}

export async function createNotification(input: {
  relationshipId: string
  recipientUserId: string
  kind: NotificationKind
  title: string
  body: string
  href?: string | null
  occurrenceKey?: string | null
}): Promise<AppNotification | null> {
  const prefs = await getNotificationPreferences(input.relationshipId, input.recipientUserId)
  if (!prefEnabled(prefs, input.kind)) return null

  if (input.occurrenceKey) {
    const existing = await listNotifications(input.relationshipId, input.recipientUserId)
    if (existing.some((n) => n.occurrenceKey === input.occurrenceKey && n.kind === input.kind)) {
      return null
    }
  }

  const notification: AppNotification = {
    id: createId('ntf'),
    relationshipId: input.relationshipId,
    recipientUserId: input.recipientUserId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
    occurrenceKey: input.occurrenceKey ?? null,
  }

  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      notifications: [...s.notifications, notification],
    }))
    notifyDemoNotificationsChanged()
    await maybeShowBrowserNotification(notification, prefs.pushEnabled)
    return notification
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'notifications', notification.id),
    notification,
  )
  await maybeShowBrowserNotification(notification, prefs.pushEnabled)
  return notification
}

export async function listNotifications(
  relationshipId: string,
  userId: string,
): Promise<AppNotification[]> {
  if (isDemoMode()) {
    return readDemoState()
      .notifications.filter(
        (n) => n.relationshipId === relationshipId && n.recipientUserId === userId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(
    query(
      collection(db, 'relationships', relationshipId, 'notifications'),
      where('recipientUserId', '==', userId),
    ),
  )
  return snap.docs
    .map((d) => d.data() as AppNotification)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function countUnreadNotifications(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.readAt).length
}

export async function markNotificationRead(
  relationshipId: string,
  notificationId: string,
): Promise<void> {
  const now = new Date().toISOString()
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === notificationId && n.relationshipId === relationshipId
          ? { ...n, readAt: n.readAt ?? now }
          : n,
      ),
    }))
    notifyDemoNotificationsChanged()
    return
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(doc(db, 'relationships', relationshipId, 'notifications', notificationId), {
    readAt: now,
  })
}

export async function markAllNotificationsRead(
  relationshipId: string,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.relationshipId === relationshipId && n.recipientUserId === userId && !n.readAt
          ? { ...n, readAt: now }
          : n,
      ),
    }))
    notifyDemoNotificationsChanged()
    return
  }
  const list = await listNotifications(relationshipId, userId)
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await Promise.all(
    list
      .filter((n) => !n.readAt)
      .map((n) =>
        updateDoc(doc(db, 'relationships', relationshipId, 'notifications', n.id), {
          readAt: now,
        }),
      ),
  )
}

/** Dominant (and switch) partners who should hear about habit events. */
function dominantRecipients(relationship: Relationship, actorUserId: string): string[] {
  return relationship.members
    .filter(
      (m) =>
        m.userId !== actorUserId &&
        (m.role === 'dominant' || m.role === 'switch'),
    )
    .map((m) => m.userId)
}

function otherMembers(relationship: Relationship, actorUserId: string): string[] {
  return relationship.members.filter((m) => m.userId !== actorUserId).map((m) => m.userId)
}

export async function notifyHabitCompleted(input: {
  relationshipId: string
  habit: Habit
  actorUserId: string
  actorDisplayName?: string
}): Promise<void> {
  const rel = await getRelationshipById(input.relationshipId)
  if (!rel) return
  const actor =
    input.actorDisplayName ??
    rel.members.find((m) => m.userId === input.actorUserId)?.displayName ??
    'Partner'
  await Promise.all(
    dominantRecipients(rel, input.actorUserId).map((recipientUserId) =>
      createNotification({
        relationshipId: input.relationshipId,
        recipientUserId,
        kind: 'habit_completed',
        title: 'Habit completed',
        body: `${actor} completed “${input.habit.title}”.`,
        href: '/habits',
        occurrenceKey: `habit_completed:${input.habit.id}:${toLocalDateKey()}`,
      }),
    ),
  )
}

export async function notifyHabitMissed(input: {
  relationshipId: string
  habit: Habit
  actorUserId: string
  actorDisplayName?: string
}): Promise<void> {
  const rel = await getRelationshipById(input.relationshipId)
  if (!rel) return
  const actor =
    input.actorDisplayName ??
    rel.members.find((m) => m.userId === input.actorUserId)?.displayName ??
    'Partner'
  await Promise.all(
    dominantRecipients(rel, input.actorUserId).map((recipientUserId) =>
      createNotification({
        relationshipId: input.relationshipId,
        recipientUserId,
        kind: 'habit_missed',
        title: 'Habit missed',
        body: `${actor} marked “${input.habit.title}” as missed.`,
        href: '/habits',
        occurrenceKey: `habit_missed:${input.habit.id}:${toLocalDateKey()}`,
      }),
    ),
  )
}

export async function notifySharedJournalEntry(input: {
  relationshipId: string
  authorUserId: string
  title: string
}): Promise<void> {
  const rel = await getRelationshipById(input.relationshipId)
  if (!rel) return
  const author =
    rel.members.find((m) => m.userId === input.authorUserId)?.displayName ?? 'Partner'
  await Promise.all(
    otherMembers(rel, input.authorUserId).map((recipientUserId) =>
      createNotification({
        relationshipId: input.relationshipId,
        recipientUserId,
        kind: 'shared_journal',
        title: 'Shared journal entry',
        body: `${author} posted “${input.title}”.`,
        href: '/journal',
      }),
    ),
  )
}

export async function notifyChatMessage(input: {
  relationshipId: string
  senderUserId: string
  preview: string
}): Promise<void> {
  const rel = await getRelationshipById(input.relationshipId)
  if (!rel) return
  const sender =
    rel.members.find((m) => m.userId === input.senderUserId)?.displayName ?? 'Partner'
  const preview = input.preview.trim() || 'New message'
  await Promise.all(
    otherMembers(rel, input.senderUserId).map((recipientUserId) =>
      createNotification({
        relationshipId: input.relationshipId,
        recipientUserId,
        kind: 'chat_message',
        title: `Message from ${sender}`,
        body: preview.slice(0, 120),
        href: '/chat',
      }),
    ),
  )
}

export async function ensureDailyPromptNotification(input: {
  relationshipId: string
  userId: string
  promptText: string
}): Promise<AppNotification | null> {
  const dateKey = toLocalDateKey()
  return createNotification({
    relationshipId: input.relationshipId,
    recipientUserId: input.userId,
    kind: 'daily_prompt',
    title: 'Daily journal prompt',
    body: input.promptText,
    href: '/journal',
    occurrenceKey: `daily_prompt:${dateKey}`,
  })
}

// ─── Habit reminders ───

export async function listHabitReminders(
  relationshipId: string,
  userId?: string,
): Promise<HabitReminder[]> {
  if (isDemoMode()) {
    return readDemoState().habitReminders.filter(
      (r) =>
        r.relationshipId === relationshipId &&
        (userId ? r.userId === userId : true),
    )
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'habitReminders'))
  return snap.docs
    .map((d) => d.data() as HabitReminder)
    .filter((r) => (userId ? r.userId === userId : true))
}

export async function setHabitReminder(input: {
  relationshipId: string
  habitId: string
  userId: string
  timeLocal: string
  enabled?: boolean
}): Promise<HabitReminder> {
  const timeLocal = input.timeLocal.trim()
  if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
    throw new Error('Reminder time must be HH:mm.')
  }

  const existing = (await listHabitReminders(input.relationshipId, input.userId)).find(
    (r) => r.habitId === input.habitId,
  )

  const reminder: HabitReminder = existing
    ? {
        ...existing,
        timeLocal,
        enabled: input.enabled ?? existing.enabled,
      }
    : {
        id: createId('hrm'),
        relationshipId: input.relationshipId,
        habitId: input.habitId,
        userId: input.userId,
        timeLocal,
        enabled: input.enabled ?? true,
        createdAt: new Date().toISOString(),
      }

  if (isDemoMode()) {
    updateDemoState((s) => {
      const others = s.habitReminders.filter((r) => r.id !== reminder.id)
      return { ...s, habitReminders: [...others, reminder] }
    })
    notifyDemoNotificationsChanged()
    return reminder
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'habitReminders', reminder.id),
    reminder,
  )
  return reminder
}

export async function deleteHabitReminder(
  relationshipId: string,
  reminderId: string,
): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      habitReminders: s.habitReminders.filter((r) => r.id !== reminderId),
    }))
    notifyDemoNotificationsChanged()
    return
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'relationships', relationshipId, 'habitReminders', reminderId))
}

export function localTimeHHMM(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export async function runDueHabitReminders(input: {
  relationshipId: string
  userId: string
  habits: Habit[]
  now?: Date
}): Promise<number> {
  const now = input.now ?? new Date()
  const hhmm = localTimeHHMM(now)
  const dateKey = toLocalDateKey(now)
  const prefs = await getNotificationPreferences(input.relationshipId, input.userId)
  if (!prefs.habitReminders) return 0

  const reminders = (await listHabitReminders(input.relationshipId, input.userId)).filter(
    (r) => r.enabled && r.timeLocal === hhmm,
  )
  let created = 0
  for (const reminder of reminders) {
    const habit = input.habits.find((h) => h.id === reminder.habitId && h.status === 'active')
    if (!habit) continue
    const n = await createNotification({
      relationshipId: input.relationshipId,
      recipientUserId: input.userId,
      kind: 'habit_reminder',
      title: 'Habit reminder',
      body: `Time for “${habit.title}”.`,
      href: '/habits',
      occurrenceKey: `habit_reminder:${reminder.habitId}:${dateKey}:${hhmm}`,
    })
    if (n) created += 1
  }
  return created
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

/**
 * Registers an FCM web push token when Firebase Messaging + VAPID are available.
 * In demo mode (or without VAPID), enables browser Notification permission only.
 */
export async function enablePushNotifications(input: {
  relationshipId: string
  userId: string
}): Promise<{ ok: boolean; message: string }> {
  const permission = await requestPushPermission()
  if (permission === 'unsupported') {
    return { ok: false, message: 'This browser does not support notifications.' }
  }
  if (permission !== 'granted') {
    return { ok: false, message: 'Notification permission was not granted.' }
  }

  let token: string | null = null
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
  const app = getFirebaseApp()
  if (app && vapidKey && !isDemoMode()) {
    try {
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
      if (await isSupported()) {
        const messaging = getMessaging(app)
        token = await getToken(messaging, { vapidKey })
      }
    } catch {
      token = null
    }
  }

  await updateNotificationPreferences({
    relationshipId: input.relationshipId,
    userId: input.userId,
    patch: { pushEnabled: true, fcmToken: token },
  })

  return {
    ok: true,
    message: token
      ? 'Push notifications enabled (FCM token saved).'
      : 'Browser notifications enabled. Add VITE_FIREBASE_VAPID_KEY for FCM delivery.',
  }
}

export async function disablePushNotifications(input: {
  relationshipId: string
  userId: string
}): Promise<void> {
  await updateNotificationPreferences({
    relationshipId: input.relationshipId,
    userId: input.userId,
    patch: { pushEnabled: false, fcmToken: null },
  })
}
