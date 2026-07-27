import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getUnlockedContentKey } from '@/features/crypto/cryptoService'
import { decryptText, encryptText } from '@/lib/crypto'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import type { ChatMessage, ChatTypingPresence, EncryptedTextRecord, JournalEntry } from '@/types/models'

const CHAT_CHANGED = 'subrosa-demo-chat'
const CHAT_TYPING_CHANGED = 'subrosa-demo-chat-typing'
export const TYPING_TTL_MS = 3500

export function notifyDemoChatChanged(): void {
  window.dispatchEvent(new Event(CHAT_CHANGED))
}

export function notifyDemoChatTypingChanged(): void {
  window.dispatchEvent(new Event(CHAT_TYPING_CHANGED))
}

export function subscribeToDemoChat(listener: () => void): () => void {
  window.addEventListener(CHAT_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHAT_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

export function subscribeToDemoChatTyping(listener: () => void): () => void {
  window.addEventListener(CHAT_TYPING_CHANGED, listener)
  window.addEventListener(CHAT_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHAT_TYPING_CHANGED, listener)
    window.removeEventListener(CHAT_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

export const LOCKED_TEXT = '[Unlock encryption key in Settings to read this text.]'
export const DECRYPT_FAILED_TEXT = '[Unable to decrypt text on this device.]'

type TextStorage = { text: string; ciphertext?: EncryptedTextRecord }

async function encodeBodyForStorage(
  relationshipId: string,
  text: string,
): Promise<TextStorage> {
  const key = await getUnlockedContentKey(relationshipId)
  if (!key || !text.trim()) return { text }
  try {
    const ciphertext = await encryptText(key, text)
    return { text: '', ciphertext }
  } catch {
    return { text }
  }
}

async function decodeBodyForRead(
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

async function hydrateMessage(message: ChatMessage): Promise<ChatMessage> {
  return {
    ...message,
    body: await decodeBodyForRead(
      message.relationshipId,
      message.body,
      message.bodyCiphertext,
    ),
    readBy: message.readBy ?? {},
  }
}

export type SendChatMessageInput = {
  relationshipId: string
  senderUserId: string
  body: string
  journalEntry?: Pick<JournalEntry, 'id' | 'title'> | null
}

export async function sendChatMessage(input: SendChatMessageInput): Promise<ChatMessage> {
  const bodyText = input.body.trim()
  if (!bodyText && !input.journalEntry) {
    throw new Error('Message cannot be empty.')
  }

  const encoded = await encodeBodyForStorage(input.relationshipId, bodyText)
  const now = new Date().toISOString()
  const message: ChatMessage = {
    id: createId('msg'),
    relationshipId: input.relationshipId,
    senderUserId: input.senderUserId,
    body: encoded.text,
    bodyCiphertext: encoded.ciphertext,
    journalEntryId: input.journalEntry?.id ?? null,
    journalEntryTitle: input.journalEntry?.title ?? null,
    createdAt: now,
    readBy: { [input.senderUserId]: now },
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      chatMessages: [...state.chatMessages, message],
    }))
    notifyDemoChatChanged()
    return hydrateMessage(message)
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', input.relationshipId, 'chatMessages', message.id), message)
  return hydrateMessage(message)
}

export async function listChatMessages(relationshipId: string): Promise<ChatMessage[]> {
  if (isDemoMode()) {
    const rows = readDemoState()
      .chatMessages.filter((m) => m.relationshipId === relationshipId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return Promise.all(rows.map(hydrateMessage))
  }

  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'chatMessages'))
  const rows = snap.docs
    .map((d) => d.data() as ChatMessage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return Promise.all(rows.map(hydrateMessage))
}

export async function markChatMessagesRead(input: {
  relationshipId: string
  userId: string
  messageIds: string[]
}): Promise<void> {
  if (input.messageIds.length === 0) return
  const now = new Date().toISOString()

  if (isDemoMode()) {
    const idSet = new Set(input.messageIds)
    updateDemoState((state) => ({
      ...state,
      chatMessages: state.chatMessages.map((m) => {
        if (!idSet.has(m.id) || m.relationshipId !== input.relationshipId) return m
        if (m.readBy?.[input.userId]) return m
        return {
          ...m,
          readBy: { ...(m.readBy ?? {}), [input.userId]: now },
        }
      }),
    }))
    notifyDemoChatChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await Promise.all(
    input.messageIds.map((id) =>
      updateDoc(doc(db, 'relationships', input.relationshipId, 'chatMessages', id), {
        [`readBy.${input.userId}`]: now,
      }),
    ),
  )
}

export async function deleteChatMessage(
  relationshipId: string,
  messageId: string,
  requesterUserId: string,
): Promise<void> {
  if (isDemoMode()) {
    const existing = readDemoState().chatMessages.find((m) => m.id === messageId)
    if (!existing) return
    if (existing.senderUserId !== requesterUserId) {
      throw new Error('Only the sender can delete this message.')
    }
    updateDemoState((state) => ({
      ...state,
      chatMessages: state.chatMessages.filter((m) => m.id !== messageId),
    }))
    notifyDemoChatChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  // Caller is responsible for auth rules; we still gate by ownership check via getDocs pattern
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'chatMessages'))
  const msg = snap.docs.map((d) => d.data() as ChatMessage).find((m) => m.id === messageId)
  if (!msg) return
  if (msg.senderUserId !== requesterUserId) {
    throw new Error('Only the sender can delete this message.')
  }
  await deleteDoc(doc(db, 'relationships', relationshipId, 'chatMessages', messageId))
}

/** Subscribe to live updates. In demo mode uses local events; with Firestore uses onSnapshot. */
export function subscribeToChatMessages(
  relationshipId: string,
  onChange: (messages: ChatMessage[]) => void,
): () => void {
  if (isDemoMode()) {
    const emit = () => {
      void listChatMessages(relationshipId).then(onChange)
    }
    emit()
    return subscribeToDemoChat(emit)
  }

  const db = getFirebaseDb()
  if (!db) {
    onChange([])
    return () => undefined
  }

  return onSnapshot(collection(db, 'relationships', relationshipId, 'chatMessages'), (snap) => {
    const rows = snap.docs
      .map((d) => d.data() as ChatMessage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    void Promise.all(rows.map(hydrateMessage)).then(onChange)
  })
}

export function countUnreadMessages(messages: ChatMessage[], userId: string): number {
  return messages.filter(
    (m) => m.senderUserId !== userId && !(m.readBy ?? {})[userId],
  ).length
}

export function previewChatBody(message: ChatMessage, maxLen = 80): string {
  if (message.bodyCiphertext && (!message.body || message.body === LOCKED_TEXT || message.body === DECRYPT_FAILED_TEXT)) {
    return 'Encrypted message'
  }
  if (isLockedPreview(message.body)) return 'Encrypted message'
  if (message.journalEntryTitle && !message.body.trim()) {
    return `Journal: ${message.journalEntryTitle}`
  }
  const text = message.body.trim() || (message.journalEntryTitle ? `Journal: ${message.journalEntryTitle}` : '')
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1)}…`
}

function isLockedPreview(value: string): boolean {
  return value === LOCKED_TEXT || value === DECRYPT_FAILED_TEXT
}

export async function setChatTyping(input: {
  relationshipId: string
  userId: string
  displayName: string
}): Promise<void> {
  const presence: ChatTypingPresence = {
    relationshipId: input.relationshipId,
    userId: input.userId,
    displayName: input.displayName,
    updatedAt: new Date().toISOString(),
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      chatTyping: [
        ...state.chatTyping.filter(
          (t) => !(t.relationshipId === input.relationshipId && t.userId === input.userId),
        ),
        presence,
      ],
    }))
    notifyDemoChatTypingChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'chatTyping', input.userId),
    presence,
  )
}

export async function clearChatTyping(input: {
  relationshipId: string
  userId: string
}): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      chatTyping: state.chatTyping.filter(
        (t) => !(t.relationshipId === input.relationshipId && t.userId === input.userId),
      ),
    }))
    notifyDemoChatTypingChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await deleteDoc(doc(db, 'relationships', input.relationshipId, 'chatTyping', input.userId))
}

export function listActiveTypers(
  relationshipId: string,
  excludeUserId?: string,
  nowMs: number = Date.now(),
): ChatTypingPresence[] {
  if (isDemoMode()) {
    return readDemoState().chatTyping.filter((t) => {
      if (t.relationshipId !== relationshipId) return false
      if (excludeUserId && t.userId === excludeUserId) return false
      const age = nowMs - new Date(t.updatedAt).getTime()
      return age >= 0 && age < TYPING_TTL_MS
    })
  }
  return []
}

export function subscribeToChatTyping(
  relationshipId: string,
  excludeUserId: string | undefined,
  onChange: (typers: ChatTypingPresence[]) => void,
): () => void {
  if (isDemoMode()) {
    const emit = () => onChange(listActiveTypers(relationshipId, excludeUserId))
    emit()
    const interval = window.setInterval(emit, 1000)
    const unsub = subscribeToDemoChatTyping(emit)
    return () => {
      window.clearInterval(interval)
      unsub()
    }
  }

  const db = getFirebaseDb()
  if (!db) {
    onChange([])
    return () => undefined
  }

  return onSnapshot(collection(db, 'relationships', relationshipId, 'chatTyping'), (snap) => {
    const now = Date.now()
    const typers = snap.docs
      .map((d) => d.data() as ChatTypingPresence)
      .filter((t) => {
        if (excludeUserId && t.userId === excludeUserId) return false
        const age = now - new Date(t.updatedAt).getTime()
        return age >= 0 && age < TYPING_TTL_MS
      })
    onChange(typers)
  })
}
