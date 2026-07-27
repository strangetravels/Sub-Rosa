import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getUnlockedContentKey } from '@/features/crypto/cryptoService'
import { applyJournalEntryPoints } from '@/features/points/pointService'
import { decryptText, encryptText } from '@/lib/crypto'
import { toLocalDateKey } from '@/lib/date'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import type {
  EncryptedTextRecord,
  JournalEntry,
  JournalEntryVisibility,
  JournalPrompt,
} from '@/types/models'

const JOURNAL_CHANGED = 'subrosa-demo-journal'

export function notifyDemoJournalChanged(): void {
  window.dispatchEvent(new Event(JOURNAL_CHANGED))
}

export function subscribeToDemoJournal(listener: () => void): () => void {
  window.addEventListener(JOURNAL_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(JOURNAL_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

export const LOCKED_TEXT = '[Unlock encryption key in Settings to read this text.]'
export const DECRYPT_FAILED_TEXT = '[Unable to decrypt text on this device.]'

// ─── Built-in prompt library ───

const PROMPT_LIBRARY: Array<{ text: string; category: string }> = [
  { text: 'What did you do today that made you feel proud?', category: 'Reflection' },
  { text: 'Describe a moment where you felt fully present.', category: 'Mindfulness' },
  { text: 'What is one thing you want your partner to know right now?', category: 'Connection' },
  { text: 'Write about a boundary you are grateful for.', category: 'Gratitude' },
  { text: 'What does trust mean to you in this dynamic?', category: 'Reflection' },
  { text: 'Describe how you felt during your last scene together.', category: 'Scenes' },
  { text: 'What habit are you most proud of maintaining?', category: 'Growth' },
  { text: 'Is there something you have been afraid to ask for?', category: 'Vulnerability' },
  { text: 'Write a note of appreciation to your partner.', category: 'Connection' },
  { text: 'What do you want more of in the next week?', category: 'Intention' },
  { text: 'Reflect on a time you felt safe in this relationship.', category: 'Gratitude' },
  { text: 'What part of your dynamic feels the most natural?', category: 'Reflection' },
  { text: 'Describe a challenge you overcame recently.', category: 'Growth' },
  { text: 'How has your understanding of your role evolved?', category: 'Reflection' },
]

export function getDailyPrompt(dateKey: string): { text: string; category: string } {
  let hash = 0
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0
  }
  return PROMPT_LIBRARY[Math.abs(hash) % PROMPT_LIBRARY.length]
}

// ─── Encryption helpers ───

async function encodeBodyForStorage(
  relationshipId: string,
  body: string,
): Promise<{ body: string; bodyCiphertext?: EncryptedTextRecord }> {
  const ck = getUnlockedContentKey(relationshipId)
  if (!ck || !body.trim()) return { body }
  try {
    const ct = await encryptText(body, ck)
    return { body: '', bodyCiphertext: ct }
  } catch {
    return { body }
  }
}

async function hydrateBody(
  relationshipId: string,
  entry: JournalEntry,
): Promise<JournalEntry> {
  if (!entry.bodyCiphertext) return entry
  const ck = getUnlockedContentKey(relationshipId)
  if (!ck) return { ...entry, body: LOCKED_TEXT }
  try {
    const plain = await decryptText(entry.bodyCiphertext, ck)
    return { ...entry, body: plain }
  } catch {
    return { ...entry, body: DECRYPT_FAILED_TEXT }
  }
}

// ─── Journal entries ───

export type CreateJournalEntryInput = {
  relationshipId: string
  authorUserId: string
  visibility: JournalEntryVisibility
  title: string
  body: string
  tags?: string[]
  promptId?: string | null
  assignedByUserId?: string | null
}

export async function createJournalEntry(
  input: CreateJournalEntryInput,
): Promise<JournalEntry> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')

  const { body, bodyCiphertext } = await encodeBodyForStorage(input.relationshipId, input.body)
  const now = new Date().toISOString()
  const entry: JournalEntry = {
    id: createId('jrn'),
    relationshipId: input.relationshipId,
    authorUserId: input.authorUserId,
    visibility: input.visibility,
    title,
    body,
    bodyCiphertext,
    tags: input.tags ?? [],
    promptId: input.promptId ?? null,
    assignedByUserId: input.assignedByUserId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  if (isDemoMode()) {
    updateDemoState((s) => ({ ...s, journalEntries: [...s.journalEntries, entry] }))
    notifyDemoJournalChanged()
  } else {
    const db = getFirebaseDb()
    if (!db) throw new Error('Firestore is not configured.')
    await setDoc(doc(db, 'relationships', input.relationshipId, 'journalEntries', entry.id), entry)
  }

  if (input.promptId) {
    await markPromptAnswered({
      relationshipId: input.relationshipId,
      promptId: input.promptId,
      entryId: entry.id,
    })
  }

  await applyJournalEntryPoints({
    relationshipId: input.relationshipId,
    userId: input.authorUserId,
    dateKey: toLocalDateKey(),
  })

  return hydrateBody(input.relationshipId, entry)
}

export type UpdateJournalEntryInput = {
  relationshipId: string
  entryId: string
  title?: string
  body?: string
  visibility?: JournalEntryVisibility
  tags?: string[]
}

export async function updateJournalEntry(input: UpdateJournalEntryInput): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (input.title !== undefined) {
    const t = input.title.trim()
    if (!t) throw new Error('Title is required.')
    patch.title = t
  }
  if (input.body !== undefined) {
    const encoded = await encodeBodyForStorage(input.relationshipId, input.body)
    patch.body = encoded.body
    patch.bodyCiphertext = encoded.bodyCiphertext ?? null
  }
  if (input.visibility !== undefined) patch.visibility = input.visibility
  if (input.tags !== undefined) patch.tags = input.tags

  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      journalEntries: s.journalEntries.map((e) =>
        e.id === input.entryId ? ({ ...e, ...patch } as JournalEntry) : e,
      ),
    }))
    notifyDemoJournalChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(
    doc(db, 'relationships', input.relationshipId, 'journalEntries', input.entryId),
    patch,
  )
}

export async function deleteJournalEntry(
  relationshipId: string,
  entryId: string,
): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      journalEntries: s.journalEntries.filter((e) => e.id !== entryId),
    }))
    notifyDemoJournalChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await deleteDoc(doc(db, 'relationships', relationshipId, 'journalEntries', entryId))
}

export async function listJournalEntries(
  relationshipId: string,
  viewerUserId: string,
): Promise<JournalEntry[]> {
  let entries: JournalEntry[]

  if (isDemoMode()) {
    entries = readDemoState().journalEntries.filter(
      (e) =>
        e.relationshipId === relationshipId &&
        (e.visibility === 'shared' || e.authorUserId === viewerUserId),
    )
  } else {
    const db = getFirebaseDb()
    if (!db) return []
    const snap = await getDocs(
      collection(db, 'relationships', relationshipId, 'journalEntries'),
    )
    entries = (snap.docs.map((d) => d.data()) as JournalEntry[]).filter(
      (e) => e.visibility === 'shared' || e.authorUserId === viewerUserId,
    )
  }

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Promise.all(entries.map((e) => hydrateBody(relationshipId, e)))
}

// ─── Custom / assigned prompts ───

export async function createJournalPrompt(input: {
  relationshipId: string
  text: string
  category: string
  createdByUserId: string
  assignedToUserId?: string | null
}): Promise<JournalPrompt> {
  const text = input.text.trim()
  if (!text) throw new Error('Prompt text is required.')
  const now = new Date().toISOString()
  const prompt: JournalPrompt = {
    id: createId('jpmt'),
    relationshipId: input.relationshipId,
    text,
    category: input.category.trim() || 'General',
    createdByUserId: input.createdByUserId,
    createdAt: now,
    assignedToUserId: input.assignedToUserId ?? null,
    status: input.assignedToUserId ? 'open' : undefined,
    answeredEntryId: null,
  }

  if (isDemoMode()) {
    updateDemoState((s) => ({ ...s, journalPrompts: [...s.journalPrompts, prompt] }))
    notifyDemoJournalChanged()
    return prompt
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'journalPrompts', prompt.id), prompt)
  return prompt
}

export async function assignJournalPrompt(input: {
  relationshipId: string
  text: string
  category?: string
  createdByUserId: string
  assignedToUserId: string
}): Promise<JournalPrompt> {
  if (!input.assignedToUserId) throw new Error('Assignee is required.')
  if (input.assignedToUserId === input.createdByUserId) {
    throw new Error('Assign the prompt to a partner, not yourself.')
  }
  return createJournalPrompt({
    relationshipId: input.relationshipId,
    text: input.text,
    category: input.category?.trim() || 'Assigned',
    createdByUserId: input.createdByUserId,
    assignedToUserId: input.assignedToUserId,
  })
}

async function markPromptAnswered(input: {
  relationshipId: string
  promptId: string
  entryId: string
}): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      journalPrompts: s.journalPrompts.map((p) =>
        p.id === input.promptId
          ? { ...p, status: 'answered' as const, answeredEntryId: input.entryId }
          : p,
      ),
    }))
    notifyDemoJournalChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(doc(db, 'relationships', input.relationshipId, 'journalPrompts', input.promptId), {
    status: 'answered',
    answeredEntryId: input.entryId,
  })
}

export async function listJournalPrompts(
  relationshipId: string,
): Promise<JournalPrompt[]> {
  if (isDemoMode()) {
    return readDemoState().journalPrompts.filter((p) => p.relationshipId === relationshipId)
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'journalPrompts'))
  return snap.docs.map((d) => d.data() as JournalPrompt)
}

export async function deleteJournalPrompt(
  relationshipId: string,
  promptId: string,
): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((s) => ({
      ...s,
      journalPrompts: s.journalPrompts.filter((p) => p.id !== promptId),
    }))
    notifyDemoJournalChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await deleteDoc(doc(db, 'relationships', relationshipId, 'journalPrompts', promptId))
}

// ─── Streak helpers ───

export function computeJournalStreak(entries: JournalEntry[], userId: string): number {
  const myDates = new Set(
    entries
      .filter((e) => e.authorUserId === userId)
      .map((e) => e.createdAt.slice(0, 10)),
  )
  if (myDates.size === 0) return 0

  let streak = 0
  const d = new Date()
  const todayKey = toLocalDateKey(d)
  // Allow streak to continue from yesterday if no entry today yet
  if (!myDates.has(todayKey)) {
    d.setDate(d.getDate() - 1)
  }
  while (true) {
    const key = toLocalDateKey(d)
    if (!myDates.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
