import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import {
  createRelationship,
  joinRelationshipByInvite,
} from '@/features/relationships/relationshipService'
import { createHabit, markHabitMissedForDate, setHabitCompletedForDate } from '@/features/habits/habitService'
import { createPunishment } from '@/features/rewards/rewardService'
import { createJournalEntry } from '@/features/journal/journalService'
import { sendChatMessage } from '@/features/chat/chatService'
import {
  countUnreadNotifications,
  ensureDailyPromptNotification,
  getNotificationPreferences,
  listHabitReminders,
  listNotifications,
  markAllNotificationsRead,
  runDueHabitReminders,
  setHabitReminder,
  updateNotificationPreferences,
} from '@/features/notifications/notificationService'

const PASS = 'encrypt-me-please'

async function setupPair(prefix: string) {
  const dom = await signUp(`${prefix}-dom@example.com`, 'secret123', 'Dom')
  const { relationship } = await createRelationship({
    user: dom,
    name: 'Notif Dynamic',
    role: 'dominant',
    passphrase: PASS,
  })
  const sub = await signUp(`${prefix}-sub@example.com`, 'secret123', 'Sub')
  await joinRelationshipByInvite({
    user: sub,
    inviteCode: relationship.inviteCode,
    role: 'submissive',
    passphrase: `${PASS}-b`,
  })
  return { dom, sub, relationship }
}

describe('notificationService', () => {
  it('notifies dominant when a habit is completed', async () => {
    const { dom, sub, relationship } = await setupPair('n-complete')
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Kneel',
      frequency: { type: 'daily' },
      assignedToUserId: sub.id,
      createdByUserId: dom.id,
    })

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: sub.id,
      completed: true,
    })

    const forDom = await listNotifications(relationship.id, dom.id)
    expect(forDom.some((n) => n.kind === 'habit_completed')).toBe(true)
    const forSub = await listNotifications(relationship.id, sub.id)
    expect(forSub.some((n) => n.kind === 'habit_completed')).toBe(false)
  })

  it('notifies dominant when a habit is missed', async () => {
    const { dom, sub, relationship } = await setupPair('n-miss')
    const punishment = await createPunishment({
      relationshipId: relationship.id,
      title: 'Corner time',
      description: '',
      severity: 2,
      createdByUserId: dom.id,
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Journal',
      frequency: { type: 'daily' },
      assignedToUserId: sub.id,
      createdByUserId: dom.id,
      linkedPunishmentId: punishment.id,
    })

    await markHabitMissedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: sub.id,
    })

    const forDom = await listNotifications(relationship.id, dom.id)
    expect(forDom.some((n) => n.kind === 'habit_missed')).toBe(true)
  })

  it('notifies partner on shared journal and chat', async () => {
    const { dom, sub, relationship } = await setupPair('n-share')
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: sub.id,
      visibility: 'shared',
      title: 'Evening note',
      body: 'Hello',
    })
    await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: sub.id,
      body: 'Hi Dom',
    })

    const forDom = await listNotifications(relationship.id, dom.id)
    expect(forDom.some((n) => n.kind === 'shared_journal')).toBe(true)
    expect(forDom.some((n) => n.kind === 'chat_message')).toBe(true)
  })

  it('respects preference toggles and marks read', async () => {
    const { dom, relationship } = await setupPair('n-prefs')
    await updateNotificationPreferences({
      relationshipId: relationship.id,
      userId: dom.id,
      patch: { dailyPrompt: false },
    })
    const prefs = await getNotificationPreferences(relationship.id, dom.id)
    expect(prefs.dailyPrompt).toBe(false)

    const skipped = await ensureDailyPromptNotification({
      relationshipId: relationship.id,
      userId: dom.id,
      promptText: 'Should not notify',
    })
    expect(skipped).toBeNull()

    await updateNotificationPreferences({
      relationshipId: relationship.id,
      userId: dom.id,
      patch: { dailyPrompt: true },
    })
    const created = await ensureDailyPromptNotification({
      relationshipId: relationship.id,
      userId: dom.id,
      promptText: 'Today’s prompt',
    })
    expect(created?.kind).toBe('daily_prompt')

    // Idempotent for the same day
    const again = await ensureDailyPromptNotification({
      relationshipId: relationship.id,
      userId: dom.id,
      promptText: 'Today’s prompt',
    })
    expect(again).toBeNull()

    let list = await listNotifications(relationship.id, dom.id)
    expect(countUnreadNotifications(list)).toBeGreaterThan(0)
    await markAllNotificationsRead(relationship.id, dom.id)
    list = await listNotifications(relationship.id, dom.id)
    expect(countUnreadNotifications(list)).toBe(0)
  })

  it('fires habit reminders at the matching local time', async () => {
    const { sub, relationship } = await setupPair('n-remind')
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Morning stretch',
      frequency: { type: 'daily' },
      assignedToUserId: sub.id,
      createdByUserId: sub.id,
    })
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const timeLocal = `${hh}:${mm}`

    await setHabitReminder({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: sub.id,
      timeLocal,
    })
    const reminders = await listHabitReminders(relationship.id, sub.id)
    expect(reminders).toHaveLength(1)

    const created = await runDueHabitReminders({
      relationshipId: relationship.id,
      userId: sub.id,
      habits: [habit],
      now,
    })
    expect(created).toBe(1)

    const list = await listNotifications(relationship.id, sub.id)
    expect(list.some((n) => n.kind === 'habit_reminder')).toBe(true)
  })
})
