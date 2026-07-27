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
import type { ChatMessage, EncryptedTextRecord, JournalEntry } from '@/types/models'

const CHAT_CHANGED = 'subrosa-demo-chat'

export function notifyDemoChatChanged(): void {
  window.dispatchEvent(new Event(CHAT_CHANGED))
}

export function subscribeToDemoChat(listener: () => void): () => void {
  window.addEventListener(CHAT_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
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
