import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { getUnlockedContentKey } from '@/features/crypto/cryptoService'
import { decryptText, encryptText } from '@/lib/crypto'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import type {
  EncryptedTextRecord,
  Habit,
  PointsLedgerEntry,
  PointsLedgerSource,
  Reward,
} from '@/types/models'
import {
  listRewards,
  notifyDemoRewardsChanged,
} from '@/features/rewards/rewardService'

const POINTS_CHANGED = 'subrosa-demo-points'

export const DEFAULT_HABIT_COMPLETION_POINTS = 10
export const DEFAULT_JOURNAL_ENTRY_POINTS = 5
export const LOCKED_TEXT = '[Unlock encryption key in Settings to read this text.]'
export const DECRYPT_FAILED_TEXT = '[Unable to decrypt text on this device.]'

export function notifyDemoPointsChanged(): void {
  window.dispatchEvent(new Event(POINTS_CHANGED))
}

export function subscribeToDemoPoints(listener: () => void): () => void {
  window.addEventListener(POINTS_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(POINTS_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
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

async function hydrateEntry(entry: PointsLedgerEntry): Promise<PointsLedgerEntry> {
  return {
    ...entry,
    note: await decodeTextForRead(entry.relationshipId, entry.note, entry.noteCiphertext),
  }
}

export function habitPointValue(habit: Habit): number {
  if (habit.pointValue === null || habit.pointValue === undefined) {
    return DEFAULT_HABIT_COMPLETION_POINTS
  }
  return Math.max(0, Math.floor(habit.pointValue))
}

export async function listPointsLedger(
  relationshipId: string,
  options?: { userId?: string },
): Promise<PointsLedgerEntry[]> {
  if (isDemoMode()) {
    const rows = readDemoState()
      .pointsLedger.filter((e) => e.relationshipId === relationshipId)
      .filter((e) => (options?.userId ? e.userId === options.userId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return Promise.all(rows.map(hydrateEntry))
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'pointsLedger'))
  const rows = snap.docs
    .map((d) => d.data() as PointsLedgerEntry)
    .filter((e) => (options?.userId ? e.userId === options.userId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Promise.all(rows.map(hydrateEntry))
}

export async function getPointsBalance(
  relationshipId: string,
  userId: string,
): Promise<number> {
  const ledger = await listPointsLedger(relationshipId, { userId })
  return ledger.reduce((sum, entry) => sum + entry.amount, 0)
}

async function createLedgerEntry(
  input: Omit<PointsLedgerEntry, 'id' | 'createdAt' | 'noteCiphertext'> & {
    note?: string
  },
): Promise<PointsLedgerEntry> {
  const encoded = await encodeTextForStorage(input.relationshipId, input.note ?? '')
  const entry: PointsLedgerEntry = {
    id: createId('pts'),
    relationshipId: input.relationshipId,
    userId: input.userId,
    amount: input.amount,
    source: input.source,
    note: encoded.text,
    noteCiphertext: encoded.ciphertext,
    createdAt: new Date().toISOString(),
    createdByUserId: input.createdByUserId,
    habitId: input.habitId,
    rewardId: input.rewardId,
    occurrenceKey: input.occurrenceKey,
    catalogHistoryId: input.catalogHistoryId,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      pointsLedger: [...state.pointsLedger, entry],
    }))
    notifyDemoPointsChanged()
    return hydrateEntry(entry)
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'pointsLedger', entry.id), entry)
  return hydrateEntry(entry)
}

export async function grantPoints(input: {
  relationshipId: string
  userId: string
  amount: number
  createdByUserId: string
  note?: string
  source?: Extract<PointsLedgerSource, 'manual_grant' | 'manual_adjust'>
}): Promise<PointsLedgerEntry> {
  const amount = Math.floor(input.amount)
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('Amount must be a non-zero integer.')
  }
  const source = input.source ?? (amount > 0 ? 'manual_grant' : 'manual_adjust')
  return createLedgerEntry({
    relationshipId: input.relationshipId,
    userId: input.userId,
    amount,
    source,
    createdByUserId: input.createdByUserId,
    note: input.note ?? '',
  })
}

export async function applyHabitCompletionPoints(input: {
  habit: Habit
  completedOn: string
  appliedByUserId: string
}): Promise<void> {
  const amount = habitPointValue(input.habit)
  if (amount <= 0) return

  const existing = await listPointsLedger(input.habit.relationshipId, {
    userId: input.habit.assignedToUserId,
  })
  if (
    existing.some(
      (entry) =>
        entry.source === 'habit_completion' &&
        entry.habitId === input.habit.id &&
        entry.occurrenceKey === input.completedOn,
    )
  ) {
    return
  }

  await createLedgerEntry({
    relationshipId: input.habit.relationshipId,
    userId: input.habit.assignedToUserId,
    amount,
    source: 'habit_completion',
    createdByUserId: input.appliedByUserId,
    note: `Points for completing ${input.habit.title}`,
    habitId: input.habit.id,
    occurrenceKey: input.completedOn,
  })
}

export async function applyJournalEntryPoints(input: {
  relationshipId: string
  userId: string
  dateKey: string
  amount?: number
}): Promise<void> {
  const amount = Math.max(0, Math.floor(input.amount ?? DEFAULT_JOURNAL_ENTRY_POINTS))
  if (amount <= 0) return

  const existing = await listPointsLedger(input.relationshipId, { userId: input.userId })
  if (
    existing.some(
      (entry) =>
        entry.source === 'journal_entry' && entry.occurrenceKey === input.dateKey,
    )
  ) {
    return
  }

  await createLedgerEntry({
    relationshipId: input.relationshipId,
    userId: input.userId,
    amount,
    source: 'journal_entry',
    createdByUserId: input.userId,
    note: 'Journal entry for the day',
    occurrenceKey: input.dateKey,
  })
}

export async function removeHabitCompletionPoints(input: {
  relationshipId: string
  habitId: string
  occurrenceKey: string
}): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      pointsLedger: state.pointsLedger.filter(
        (entry) =>
          !(
            entry.relationshipId === input.relationshipId &&
            entry.source === 'habit_completion' &&
            entry.habitId === input.habitId &&
            entry.occurrenceKey === input.occurrenceKey
          ),
      ),
    }))
    notifyDemoPointsChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const snap = await getDocs(
    query(
      collection(db, 'relationships', input.relationshipId, 'pointsLedger'),
      where('source', '==', 'habit_completion'),
      where('habitId', '==', input.habitId),
      where('occurrenceKey', '==', input.occurrenceKey),
    ),
  )
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}

async function createPurchaseHistory(input: {
  relationshipId: string
  reward: Reward
  targetUserId: string
  appliedByUserId: string
  note: string
}): Promise<string> {
  const encoded = await encodeTextForStorage(input.relationshipId, input.note)
  const entry = {
    id: createId('hist'),
    relationshipId: input.relationshipId,
    itemType: 'reward' as const,
    itemId: input.reward.id,
    itemTitle: input.reward.title,
    source: 'reward_purchase' as const,
    targetUserId: input.targetUserId,
    appliedByUserId: input.appliedByUserId,
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
    return entry.id
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'catalogHistory', entry.id), entry)
  return entry.id
}

export async function purchaseRewardWithPoints(input: {
  relationshipId: string
  rewardId: string
  buyerUserId: string
  note?: string
}): Promise<{ ledger: PointsLedgerEntry; catalogHistoryId: string }> {
  const rewards = await listRewards(input.relationshipId, { includeArchived: true })
  const reward = rewards.find((r) => r.id === input.rewardId)
  if (!reward) throw new Error('Reward not found.')
  if (reward.status !== 'active') throw new Error('Reward is archived.')

  const cost = Math.max(0, Math.floor(reward.pointCost))
  if (cost <= 0) {
    throw new Error('This reward has no point cost. Apply it from Rewards instead.')
  }

  const balance = await getPointsBalance(input.relationshipId, input.buyerUserId)
  if (balance < cost) {
    throw new Error(`Not enough points. Balance ${balance}, cost ${cost}.`)
  }

  const note = input.note?.trim() || `Purchased from reward store: ${reward.title}`
  const catalogHistoryId = await createPurchaseHistory({
    relationshipId: input.relationshipId,
    reward,
    targetUserId: input.buyerUserId,
    appliedByUserId: input.buyerUserId,
    note,
  })

  const ledger = await createLedgerEntry({
    relationshipId: input.relationshipId,
    userId: input.buyerUserId,
    amount: -cost,
    source: 'reward_purchase',
    createdByUserId: input.buyerUserId,
    note,
    rewardId: reward.id,
    catalogHistoryId,
  })

  return { ledger, catalogHistoryId }
}
