import { deleteUser } from 'firebase/auth'
import { deleteDoc, doc } from 'firebase/firestore'
import { signOut, notifyDemoAuthChanged } from '@/features/auth/authService'
import { listChatMessages } from '@/features/chat/chatService'
import { listCategories, listCompletions, listHabits } from '@/features/habits/habitService'
import { listJournalEntries, listJournalPrompts } from '@/features/journal/journalService'
import {
  listHabitReminders,
  listNotifications,
  getNotificationPreferences,
} from '@/features/notifications/notificationService'
import { listPointsLedger } from '@/features/points/pointService'
import { listRelationshipsForUser } from '@/features/relationships/relationshipService'
import {
  listCatalogHistory,
  listPunishments,
  listRewardPunishmentCategories,
  listRewards,
} from '@/features/rewards/rewardService'
import {
  listRuleAcknowledgments,
  listRuleCategories,
  listRules,
  listRuleVersions,
} from '@/features/rules/ruleService'
import { clearSessionUnlock } from '@/features/security/securitySettings'
import { readDemoState, updateDemoState, type DemoState } from '@/lib/demo/store'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import type {
  AppNotification,
  CatalogHistoryEntry,
  ChatMessage,
  Habit,
  HabitCategory,
  HabitCompletion,
  HabitReminder,
  JournalEntry,
  JournalPrompt,
  NotificationPreferences,
  PointsLedgerEntry,
  Punishment,
  Relationship,
  Reward,
  RewardPunishmentCategory,
  Rule,
  RuleAcknowledgment,
  RuleCategory,
  RuleVersion,
  UserProfile,
} from '@/types/models'

export type UserDataExport = {
  exportedAt: string
  version: 1
  user: UserProfile
  relationships: Relationship[]
  habits: Habit[]
  habitCategories: HabitCategory[]
  habitCompletions: HabitCompletion[]
  rewards: Reward[]
  punishments: Punishment[]
  rewardPunishmentCategories: RewardPunishmentCategory[]
  catalogHistory: CatalogHistoryEntry[]
  pointsLedger: PointsLedgerEntry[]
  rules: Rule[]
  ruleCategories: RuleCategory[]
  ruleVersions: RuleVersion[]
  ruleAcknowledgments: RuleAcknowledgment[]
  journalEntries: JournalEntry[]
  journalPrompts: JournalPrompt[]
  chatMessages: ChatMessage[]
  notificationPreferences: NotificationPreferences[]
  notifications: AppNotification[]
  habitReminders: HabitReminder[]
}

function relationshipIdsForUser(state: DemoState, userId: string): Set<string> {
  return new Set(
    state.relationships
      .filter((r) => r.members.some((m) => m.userId === userId))
      .map((r) => r.id),
  )
}

export function buildDemoUserDataExport(user: UserProfile): UserDataExport {
  const state = readDemoState()
  const relIds = relationshipIdsForUser(state, user.id)
  const inRel = <T extends { relationshipId: string }>(items: T[]) =>
    items.filter((item) => relIds.has(item.relationshipId))

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    user,
    relationships: state.relationships.filter((r) => relIds.has(r.id)),
    habits: inRel(state.habits),
    habitCategories: inRel(state.habitCategories),
    habitCompletions: inRel(state.habitCompletions),
    rewards: inRel(state.rewards),
    punishments: inRel(state.punishments),
    rewardPunishmentCategories: inRel(state.rewardPunishmentCategories),
    catalogHistory: inRel(state.catalogHistory),
    pointsLedger: inRel(state.pointsLedger),
    rules: inRel(state.rules),
    ruleCategories: inRel(state.ruleCategories),
    ruleVersions: inRel(state.ruleVersions),
    ruleAcknowledgments: inRel(state.ruleAcknowledgments),
    journalEntries: inRel(state.journalEntries),
    journalPrompts: inRel(state.journalPrompts),
    chatMessages: inRel(state.chatMessages),
    notificationPreferences: inRel(state.notificationPreferences),
    notifications: inRel(state.notifications),
    habitReminders: inRel(state.habitReminders),
  }
}

export async function buildUserDataExport(user: UserProfile): Promise<UserDataExport> {
  if (isDemoMode()) return buildDemoUserDataExport(user)

  const relationships = await listRelationshipsForUser(user.id)
  const habits: Habit[] = []
  const habitCategories: HabitCategory[] = []
  const habitCompletions: HabitCompletion[] = []
  const rewards: Reward[] = []
  const punishments: Punishment[] = []
  const rewardPunishmentCategories: RewardPunishmentCategory[] = []
  const catalogHistory: CatalogHistoryEntry[] = []
  const pointsLedger: PointsLedgerEntry[] = []
  const rules: Rule[] = []
  const ruleCategories: RuleCategory[] = []
  const ruleVersions: RuleVersion[] = []
  const ruleAcknowledgments: RuleAcknowledgment[] = []
  const journalEntries: JournalEntry[] = []
  const journalPrompts: JournalPrompt[] = []
  const chatMessages: ChatMessage[] = []
  const notificationPreferences: NotificationPreferences[] = []
  const notifications: AppNotification[] = []
  const habitReminders: HabitReminder[] = []

  for (const rel of relationships) {
    const [
      nextHabits,
      nextHabitCategories,
      nextCompletions,
      nextRewards,
      nextPunishments,
      nextRpCategories,
      nextHistory,
      nextPoints,
      nextRules,
      nextRuleCategories,
      nextRuleAcks,
      nextJournal,
      nextPrompts,
      nextChat,
      nextPrefs,
      nextNotifications,
      nextReminders,
    ] = await Promise.all([
      listHabits(rel.id, { includeArchived: true }),
      listCategories(rel.id),
      listCompletions(rel.id),
      listRewards(rel.id, { includeArchived: true }),
      listPunishments(rel.id, { includeArchived: true }),
      listRewardPunishmentCategories(rel.id),
      listCatalogHistory(rel.id),
      listPointsLedger(rel.id),
      listRules(rel.id, { includeArchived: true }),
      listRuleCategories(rel.id),
      listRuleAcknowledgments(rel.id),
      listJournalEntries(rel.id, user.id),
      listJournalPrompts(rel.id),
      listChatMessages(rel.id),
      getNotificationPreferences(rel.id, user.id),
      listNotifications(rel.id, user.id),
      listHabitReminders(rel.id, user.id),
    ])

    const versionBatches = await Promise.all(
      nextRules.map((rule) => listRuleVersions(rel.id, rule.id)),
    )

    habits.push(...nextHabits)
    habitCategories.push(...nextHabitCategories)
    habitCompletions.push(...nextCompletions)
    rewards.push(...nextRewards)
    punishments.push(...nextPunishments)
    rewardPunishmentCategories.push(...nextRpCategories)
    catalogHistory.push(...nextHistory)
    pointsLedger.push(...nextPoints)
    rules.push(...nextRules)
    ruleCategories.push(...nextRuleCategories)
    ruleVersions.push(...versionBatches.flat())
    ruleAcknowledgments.push(...nextRuleAcks)
    journalEntries.push(...nextJournal)
    journalPrompts.push(...nextPrompts)
    chatMessages.push(...nextChat)
    notificationPreferences.push(nextPrefs)
    notifications.push(...nextNotifications)
    habitReminders.push(...nextReminders)
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    user,
    relationships,
    habits,
    habitCategories,
    habitCompletions,
    rewards,
    punishments,
    rewardPunishmentCategories,
    catalogHistory,
    pointsLedger,
    rules,
    ruleCategories,
    ruleVersions,
    ruleAcknowledgments,
    journalEntries,
    journalPrompts,
    chatMessages,
    notificationPreferences,
    notifications,
    habitReminders,
  }
}

export async function downloadUserDataExport(user: UserProfile): Promise<UserDataExport> {
  const payload = await buildUserDataExport(user)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sub-rosa-export-${user.id.slice(0, 8)}-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return payload
}

/**
 * Removes the local account and relationship-scoped demo data owned solely by this user.
 * Leaves multi-member relationships but strips this member; deletes solo relationships entirely.
 */
export async function deleteAccountLocal(user: UserProfile): Promise<void> {
  clearSessionUnlock(user.id)

  if (isDemoMode()) {
    updateDemoState((state) => {
      const nextRelationships = state.relationships
        .map((rel) => ({
          ...rel,
          members: rel.members.filter((m) => m.userId !== user.id),
        }))
        .filter((rel) => rel.members.length > 0)

      const keepIds = new Set(nextRelationships.map((r) => r.id))
      const keep = <T extends { relationshipId: string }>(items: T[]) =>
        items.filter((item) => keepIds.has(item.relationshipId))

      const { [user.id]: _removed, ...accounts } = state.accounts
      const { [user.id]: _active, ...activeRelationshipIdByUser } =
        state.activeRelationshipIdByUser

      return {
        ...state,
        accounts,
        sessionUserId: state.sessionUserId === user.id ? null : state.sessionUserId,
        activeRelationshipIdByUser,
        relationships: nextRelationships,
        habits: keep(state.habits),
        habitCategories: keep(state.habitCategories),
        habitCompletions: keep(state.habitCompletions),
        rewards: keep(state.rewards),
        punishments: keep(state.punishments),
        rewardPunishmentCategories: keep(state.rewardPunishmentCategories),
        catalogHistory: keep(state.catalogHistory),
        pointsLedger: keep(state.pointsLedger),
        rules: keep(state.rules),
        ruleCategories: keep(state.ruleCategories),
        ruleVersions: keep(state.ruleVersions),
        ruleAcknowledgments: keep(state.ruleAcknowledgments),
        journalEntries: keep(state.journalEntries),
        journalPrompts: keep(state.journalPrompts),
        chatMessages: keep(state.chatMessages),
        chatTyping: state.chatTyping.filter((t) => keepIds.has(t.relationshipId)),
        notificationPreferences: keep(state.notificationPreferences),
        notifications: keep(state.notifications),
        habitReminders: keep(state.habitReminders),
      }
    })
    notifyDemoAuthChanged()
    return
  }

  const db = getFirebaseDb()
  if (db) {
    try {
      await deleteDoc(doc(db, 'users', user.id))
    } catch {
      // User doc may already be gone
    }
  }

  const auth = getFirebaseAuth()
  if (auth?.currentUser) {
    try {
      await deleteUser(auth.currentUser)
    } catch (err) {
      await signOut()
      throw new Error(
        err instanceof Error
          ? `${err.message} Signed out locally. Re-authenticate soon after login to delete the Firebase Auth user, or delete it from the Firebase console.`
          : 'Could not delete Firebase Auth user. Signed out locally.',
      )
    }
  } else {
    await signOut()
  }
}
