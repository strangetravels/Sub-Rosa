import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getUnlockedContentKey } from '@/features/crypto/cryptoService'
import { decryptText, encryptText } from '@/lib/crypto'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import type {
  CatalogHistoryEntry,
  CatalogStatus,
  EncryptedTextRecord,
  Habit,
  Punishment,
  Reward,
  RewardPunishmentCategory,
} from '@/types/models'

const RP_CHANGED = 'subrosa-demo-rewards'

export function notifyDemoRewardsChanged(): void {
  window.dispatchEvent(new Event(RP_CHANGED))
}

export function subscribeToDemoRewards(listener: () => void): () => void {
  window.addEventListener(RP_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(RP_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

const DEFAULT_CATEGORIES: Array<{ label: string; color: string }> = [
  { label: 'Protocol', color: '#e11d48' },
  { label: 'Care', color: '#0d9488' },
  { label: 'Privilege', color: '#2563eb' },
  { label: 'Correction', color: '#a855f7' },
]

export const LOCKED_TEXT = '[Unlock encryption key in Settings to read this text.]'
export const DECRYPT_FAILED_TEXT = '[Unable to decrypt text on this device.]'

export async function ensureDefaultRewardPunishmentCategories(
  relationshipId: string,
): Promise<RewardPunishmentCategory[]> {
  const existing = await listRewardPunishmentCategories(relationshipId)
  if (existing.length > 0) return existing

  const created = DEFAULT_CATEGORIES.map((c) => ({
    id: createId('rpcat'),
    relationshipId,
    label: c.label,
    color: c.color,
  }))

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      rewardPunishmentCategories: [...state.rewardPunishmentCategories, ...created],
    }))
    notifyDemoRewardsChanged()
    return created
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await Promise.all(
    created.map((cat) =>
      setDoc(doc(db, 'relationships', relationshipId, 'rewardPunishmentCategories', cat.id), cat),
    ),
  )
  return created
}

export async function listRewardPunishmentCategories(
  relationshipId: string,
): Promise<RewardPunishmentCategory[]> {
  if (isDemoMode()) {
    return readDemoState().rewardPunishmentCategories.filter(
      (c) => c.relationshipId === relationshipId,
    )
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(
    collection(db, 'relationships', relationshipId, 'rewardPunishmentCategories'),
  )
  return snap.docs.map((d) => d.data() as RewardPunishmentCategory)
}

export async function createRewardPunishmentCategory(input: {
  relationshipId: string
  label: string
  color: string
}): Promise<RewardPunishmentCategory> {
  const label = input.label.trim()
  if (!label) throw new Error('Category name is required.')
  const category: RewardPunishmentCategory = {
    id: createId('rpcat'),
    relationshipId: input.relationshipId,
    label,
    color: input.color.trim() || '#78716c',
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      rewardPunishmentCategories: [...state.rewardPunishmentCategories, category],
    }))
    notifyDemoRewardsChanged()
    return category
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'rewardPunishmentCategories', category.id),
    category,
  )
  return category
}

type TextStorage = { text: string; ciphertext?: EncryptedTextRecord }

async function encodeTextForStorage(
  relationshipId: string,
  text: string,
): Promise<TextStorage> {
  const key = await getUnlockedContentKey(relationshipId)
  if (!key) return { text }
  const ciphertext = await encryptText(key, text)
  return { text: '', ciphertext }
}

async function decodeTextForRead(
  relationshipId: string,
  text: string,
  ciphertext?: EncryptedTextRecord,
): Promise<string> {
  if (!ciphertext) return text
  const key = await getUnlockedContentKey(relationshipId)
  if (!key) return LOCKED_TEXT
  try {
    return await decryptText(key, ciphertext)
  } catch {
    return DECRYPT_FAILED_TEXT
  }
}

async function hydrateReward(reward: Reward): Promise<Reward> {
  return {
    ...reward,
    description: await decodeTextForRead(
      reward.relationshipId,
      reward.description,
      reward.descriptionCiphertext,
    ),
  }
}

async function hydratePunishment(punishment: Punishment): Promise<Punishment> {
  return {
    ...punishment,
    description: await decodeTextForRead(
      punishment.relationshipId,
      punishment.description,
      punishment.descriptionCiphertext,
    ),
  }
}

async function hydrateHistory(entry: CatalogHistoryEntry): Promise<CatalogHistoryEntry> {
  return {
    ...entry,
    note: await decodeTextForRead(entry.relationshipId, entry.note, entry.noteCiphertext),
  }
}

export async function listRewards(
  relationshipId: string,
  options?: { includeArchived?: boolean },
): Promise<Reward[]> {
  const includeArchived = options?.includeArchived ?? false
  if (isDemoMode()) {
    const rows = readDemoState()
      .rewards.filter((r) => r.relationshipId === relationshipId)
      .filter((r) => includeArchived || r.status === 'active')
      .sort((a, b) => a.title.localeCompare(b.title))
    return Promise.all(rows.map(hydrateReward))
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'rewards'))
  const rows = snap.docs
    .map((d) => d.data() as Reward)
    .filter((r) => includeArchived || r.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title))
  return Promise.all(rows.map(hydrateReward))
}

export async function listPunishments(
  relationshipId: string,
  options?: { includeArchived?: boolean },
): Promise<Punishment[]> {
  const includeArchived = options?.includeArchived ?? false
  if (isDemoMode()) {
    const rows = readDemoState()
      .punishments.filter((p) => p.relationshipId === relationshipId)
      .filter((p) => includeArchived || p.status === 'active')
      .sort((a, b) => a.title.localeCompare(b.title))
    return Promise.all(rows.map(hydratePunishment))
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'punishments'))
  const rows = snap.docs
    .map((d) => d.data() as Punishment)
    .filter((p) => includeArchived || p.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title))
  return Promise.all(rows.map(hydratePunishment))
}

export async function listCatalogHistory(relationshipId: string): Promise<CatalogHistoryEntry[]> {
  if (isDemoMode()) {
    const rows = readDemoState()
      .catalogHistory.filter((h) => h.relationshipId === relationshipId)
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    return Promise.all(rows.map(hydrateHistory))
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'catalogHistory'))
  const rows = snap.docs
    .map((d) => d.data() as CatalogHistoryEntry)
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
  return Promise.all(rows.map(hydrateHistory))
}

export async function createReward(input: {
  relationshipId: string
  title: string
  description?: string
  categoryId?: string | null
  pointCost?: number
  createdByUserId: string
}): Promise<Reward> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  const encoded = await encodeTextForStorage(input.relationshipId, (input.description ?? '').trim())
  const now = new Date().toISOString()
  const reward: Reward = {
    id: createId('reward'),
    relationshipId: input.relationshipId,
    title,
    description: encoded.text,
    descriptionCiphertext: encoded.ciphertext,
    categoryId: input.categoryId ?? null,
    pointCost: Math.max(0, input.pointCost ?? 0),
    status: 'active',
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  }
  if (isDemoMode()) {
    updateDemoState((state) => ({ ...state, rewards: [...state.rewards, reward] }))
    notifyDemoRewardsChanged()
    return hydrateReward(reward)
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'rewards', reward.id), reward)
  return hydrateReward(reward)
}

export async function createPunishment(input: {
  relationshipId: string
  title: string
  description?: string
  categoryId?: string | null
  severity?: number
  createdByUserId: string
}): Promise<Punishment> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  const encoded = await encodeTextForStorage(input.relationshipId, (input.description ?? '').trim())
  const now = new Date().toISOString()
  const punishment: Punishment = {
    id: createId('punish'),
    relationshipId: input.relationshipId,
    title,
    description: encoded.text,
    descriptionCiphertext: encoded.ciphertext,
    categoryId: input.categoryId ?? null,
    severity: normalizeSeverity(input.severity ?? 3),
    status: 'active',
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  }
  if (isDemoMode()) {
    updateDemoState((state) => ({ ...state, punishments: [...state.punishments, punishment] }))
    notifyDemoRewardsChanged()
    return hydratePunishment(punishment)
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'punishments', punishment.id),
    punishment,
  )
  return hydratePunishment(punishment)
}

export async function updateReward(
  relationshipId: string,
  rewardId: string,
  patch: {
    title?: string
    description?: string
    categoryId?: string | null
    pointCost?: number
    status?: CatalogStatus
  },
): Promise<Reward> {
  const current = await getStoredReward(relationshipId, rewardId)
  const title = patch.title !== undefined ? patch.title.trim() || current.title : current.title
  const descriptionInput =
    patch.description !== undefined ? patch.description.trim() : current.description
  const encoded = await encodeTextForStorage(relationshipId, descriptionInput)
  const updated: Reward = {
    ...current,
    title,
    description: encoded.text,
    descriptionCiphertext: encoded.ciphertext,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : current.categoryId,
    pointCost: patch.pointCost !== undefined ? Math.max(0, patch.pointCost) : current.pointCost,
    status: patch.status ?? current.status,
    updatedAt: new Date().toISOString(),
  }
  await persistReward(updated)
  return hydrateReward(updated)
}

export async function updatePunishment(
  relationshipId: string,
  punishmentId: string,
  patch: {
    title?: string
    description?: string
    categoryId?: string | null
    severity?: number
    status?: CatalogStatus
  },
): Promise<Punishment> {
  const current = await getStoredPunishment(relationshipId, punishmentId)
  const title = patch.title !== undefined ? patch.title.trim() || current.title : current.title
  const descriptionInput =
    patch.description !== undefined ? patch.description.trim() : current.description
  const encoded = await encodeTextForStorage(relationshipId, descriptionInput)
  const updated: Punishment = {
    ...current,
    title,
    description: encoded.text,
    descriptionCiphertext: encoded.ciphertext,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : current.categoryId,
    severity:
      patch.severity !== undefined ? normalizeSeverity(patch.severity) : current.severity,
    status: patch.status ?? current.status,
    updatedAt: new Date().toISOString(),
  }
  await persistPunishment(updated)
  return hydratePunishment(updated)
}

async function persistReward(reward: Reward): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      rewards: state.rewards.map((r) => (r.id === reward.id ? reward : r)),
    }))
    notifyDemoRewardsChanged()
    return
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(doc(db, 'relationships', reward.relationshipId, 'rewards', reward.id), {
    title: reward.title,
    description: reward.description,
    descriptionCiphertext: reward.descriptionCiphertext ?? null,
    categoryId: reward.categoryId,
    pointCost: reward.pointCost,
    status: reward.status,
    updatedAt: reward.updatedAt,
  })
}

async function persistPunishment(punishment: Punishment): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      punishments: state.punishments.map((p) => (p.id === punishment.id ? punishment : p)),
    }))
    notifyDemoRewardsChanged()
    return
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(
    doc(db, 'relationships', punishment.relationshipId, 'punishments', punishment.id),
    {
      title: punishment.title,
      description: punishment.description,
      descriptionCiphertext: punishment.descriptionCiphertext ?? null,
      categoryId: punishment.categoryId,
      severity: punishment.severity,
      status: punishment.status,
      updatedAt: punishment.updatedAt,
    },
  )
}

async function getStoredReward(relationshipId: string, rewardId: string): Promise<Reward> {
  if (isDemoMode()) {
    const reward = readDemoState().rewards.find(
      (r) => r.id === rewardId && r.relationshipId === relationshipId,
    )
    if (!reward) throw new Error('Reward not found.')
    return reward
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const snap = await getDoc(doc(db, 'relationships', relationshipId, 'rewards', rewardId))
  if (!snap.exists()) throw new Error('Reward not found.')
  return snap.data() as Reward
}

async function getStoredPunishment(
  relationshipId: string,
  punishmentId: string,
): Promise<Punishment> {
  if (isDemoMode()) {
    const punishment = readDemoState().punishments.find(
      (p) => p.id === punishmentId && p.relationshipId === relationshipId,
    )
    if (!punishment) throw new Error('Punishment not found.')
    return punishment
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const snap = await getDoc(doc(db, 'relationships', relationshipId, 'punishments', punishmentId))
  if (!snap.exists()) throw new Error('Punishment not found.')
  return snap.data() as Punishment
}

function normalizeSeverity(value: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.floor(value))) as 1 | 2 | 3 | 4 | 5
}

export async function applyRewardManually(input: {
  relationshipId: string
  rewardId: string
  targetUserId: string
  appliedByUserId: string
  note?: string
}): Promise<CatalogHistoryEntry> {
  const reward = await getStoredReward(input.relationshipId, input.rewardId)
  return createHistoryEntry({
    relationshipId: input.relationshipId,
    itemType: 'reward',
    itemId: reward.id,
    itemTitle: reward.title,
    source: 'manual_reward',
    targetUserId: input.targetUserId,
    appliedByUserId: input.appliedByUserId,
    note: input.note ?? '',
  })
}

export async function applyPunishmentManually(input: {
  relationshipId: string
  punishmentId: string
  targetUserId: string
  appliedByUserId: string
  note?: string
  ruleId?: string
  source?: 'manual_punishment' | 'rule_violation' | 'habit_punishment'
}): Promise<CatalogHistoryEntry> {
  const punishment = await getStoredPunishment(input.relationshipId, input.punishmentId)
  return createHistoryEntry({
    relationshipId: input.relationshipId,
    itemType: 'punishment',
    itemId: punishment.id,
    itemTitle: punishment.title,
    source: input.source ?? 'manual_punishment',
    targetUserId: input.targetUserId,
    appliedByUserId: input.appliedByUserId,
    note: input.note ?? '',
    ruleId: input.ruleId,
  })
}

export async function archiveReward(
  relationshipId: string,
  rewardId: string,
): Promise<Reward> {
  return updateReward(relationshipId, rewardId, { status: 'archived' })
}

export async function restoreReward(
  relationshipId: string,
  rewardId: string,
): Promise<Reward> {
  return updateReward(relationshipId, rewardId, { status: 'active' })
}

export async function archivePunishment(
  relationshipId: string,
  punishmentId: string,
): Promise<Punishment> {
  return updatePunishment(relationshipId, punishmentId, { status: 'archived' })
}

export async function restorePunishment(
  relationshipId: string,
  punishmentId: string,
): Promise<Punishment> {
  return updatePunishment(relationshipId, punishmentId, { status: 'active' })
}

export async function applyAutoRewardForHabitCompletion(input: {
  habit: Habit
  completedOn: string
  appliedByUserId: string
}): Promise<void> {
  if (!input.habit.linkedRewardId) return
  const existing = await listCatalogHistory(input.habit.relationshipId)
  if (
    existing.some(
      (entry) =>
        entry.source === 'habit_completion' &&
        entry.habitId === input.habit.id &&
        entry.occurrenceKey === input.completedOn &&
        entry.itemId === input.habit.linkedRewardId,
    )
  ) {
    return
  }
  const reward = await getStoredReward(input.habit.relationshipId, input.habit.linkedRewardId)
  await createHistoryEntry({
    relationshipId: input.habit.relationshipId,
    itemType: 'reward',
    itemId: reward.id,
    itemTitle: reward.title,
    source: 'habit_completion',
    targetUserId: input.habit.assignedToUserId,
    appliedByUserId: input.appliedByUserId,
    note: `Auto-applied for completing ${input.habit.title}`,
    habitId: input.habit.id,
    occurrenceKey: input.completedOn,
  })
}

export async function removeAutoRewardForHabitCompletion(input: {
  relationshipId: string
  habitId: string
  occurrenceKey: string
}): Promise<void> {
  await removeCatalogHistoryBySource({
    ...input,
    source: 'habit_completion',
  })
}

export async function applyAutoPunishmentForHabitMiss(input: {
  habit: Habit
  missedOn: string
  appliedByUserId: string
}): Promise<void> {
  if (!input.habit.linkedPunishmentId) return
  const existing = await listCatalogHistory(input.habit.relationshipId)
  if (
    existing.some(
      (entry) =>
        entry.source === 'habit_punishment' &&
        entry.habitId === input.habit.id &&
        entry.occurrenceKey === input.missedOn &&
        entry.itemId === input.habit.linkedPunishmentId,
    )
  ) {
    return
  }
  const punishment = await getStoredPunishment(
    input.habit.relationshipId,
    input.habit.linkedPunishmentId,
  )
  await createHistoryEntry({
    relationshipId: input.habit.relationshipId,
    itemType: 'punishment',
    itemId: punishment.id,
    itemTitle: punishment.title,
    source: 'habit_punishment',
    targetUserId: input.habit.assignedToUserId,
    appliedByUserId: input.appliedByUserId,
    note: `Auto-applied for missing ${input.habit.title}`,
    habitId: input.habit.id,
    occurrenceKey: input.missedOn,
  })
}

export async function removeAutoPunishmentForHabitMiss(input: {
  relationshipId: string
  habitId: string
  occurrenceKey: string
}): Promise<void> {
  await removeCatalogHistoryBySource({
    ...input,
    source: 'habit_punishment',
  })
}

export function hasHabitMissPunishment(
  history: CatalogHistoryEntry[],
  habitId: string,
  occurrenceKey: string,
): boolean {
  return history.some(
    (entry) =>
      entry.source === 'habit_punishment' &&
      entry.habitId === habitId &&
      entry.occurrenceKey === occurrenceKey,
  )
}

async function removeCatalogHistoryBySource(input: {
  relationshipId: string
  habitId: string
  occurrenceKey: string
  source: 'habit_completion' | 'habit_punishment'
}): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      catalogHistory: state.catalogHistory.filter(
        (entry) =>
          !(
            entry.relationshipId === input.relationshipId &&
            entry.source === input.source &&
            entry.habitId === input.habitId &&
            entry.occurrenceKey === input.occurrenceKey
          ),
      ),
    }))
    notifyDemoRewardsChanged()
    return
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const snap = await getDocs(
    query(
      collection(db, 'relationships', input.relationshipId, 'catalogHistory'),
      where('source', '==', input.source),
      where('habitId', '==', input.habitId),
      where('occurrenceKey', '==', input.occurrenceKey),
    ),
  )
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}

async function createHistoryEntry(input: Omit<CatalogHistoryEntry, 'id' | 'appliedAt' | 'noteCiphertext'>): Promise<CatalogHistoryEntry> {
  const encoded = await encodeTextForStorage(input.relationshipId, input.note)
  const entry: CatalogHistoryEntry = {
    ...input,
    id: createId('hist'),
    appliedAt: new Date().toISOString(),
    note: encoded.text,
    noteCiphertext: encoded.ciphertext,
  }
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      catalogHistory: [...state.catalogHistory, entry],
    }))
    notifyDemoRewardsChanged()
    return hydrateHistory(entry)
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'catalogHistory', entry.id), entry)
  return hydrateHistory(entry)
}
