import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import {
  createRelationship,
  joinRelationshipByInvite,
} from '@/features/relationships/relationshipService'
import { createJournalEntry } from '@/features/journal/journalService'
import {
  countUnreadMessages,
  deleteChatMessage,
  listChatMessages,
  markChatMessagesRead,
  sendChatMessage,
} from '@/features/chat/chatService'

const PASS = 'encrypt-me-please'

async function setupPair(prefix: string) {
  const a = await signUp(`${prefix}-a@example.com`, 'secret123', 'Alice')
  const { relationship } = await createRelationship({
    user: a,
    name: 'Chat Dynamic',
    role: 'dominant',
    passphrase: PASS,
  })
  const b = await signUp(`${prefix}-b@example.com`, 'secret123', 'Bob')
  await joinRelationshipByInvite({
    user: b,
    inviteCode: relationship.inviteCode,
    role: 'submissive',
    passphrase: `${PASS}-b`,
  })
  return { a, b, relationship }
}

describe('chatService', () => {
  it('sends and lists messages in order', async () => {
    const { a, relationship } = await setupPair('chat-order')
    await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: a.id,
      body: 'Hello',
    })
    await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: a.id,
      body: 'Second',
    })

    const messages = await listChatMessages(relationship.id)
    expect(messages).toHaveLength(2)
    expect(messages[0].body).toBe('Hello')
    expect(messages[1].body).toBe('Second')
  })

  it('attaches a journal entry to a message', async () => {
    const { a, relationship } = await setupPair('chat-jrn')
    const entry = await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: a.id,
      visibility: 'shared',
      title: 'Scene notes',
      body: 'Details',
    })

    const msg = await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: a.id,
      body: 'Look at this',
      journalEntry: { id: entry.id, title: entry.title },
    })

    expect(msg.journalEntryId).toBe(entry.id)
    expect(msg.journalEntryTitle).toBe('Scene notes')
  })

  it('rejects empty messages without an attachment', async () => {
    const { a, relationship } = await setupPair('chat-empty')
    await expect(
      sendChatMessage({
        relationshipId: relationship.id,
        senderUserId: a.id,
        body: '   ',
      }),
    ).rejects.toThrow(/empty/i)
  })

  it('marks messages read and counts unread', async () => {
    const { a, b, relationship } = await setupPair('chat-read')
    const msg = await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: a.id,
      body: 'Unread for Bob',
    })

    let list = await listChatMessages(relationship.id)
    expect(countUnreadMessages(list, b.id)).toBe(1)

    await markChatMessagesRead({
      relationshipId: relationship.id,
      userId: b.id,
      messageIds: [msg.id],
    })

    list = await listChatMessages(relationship.id)
    expect(countUnreadMessages(list, b.id)).toBe(0)
    expect(list[0].readBy[b.id]).toBeTruthy()
  })

  it('only allows the sender to delete a message', async () => {
    const { a, b, relationship } = await setupPair('chat-del')
    const msg = await sendChatMessage({
      relationshipId: relationship.id,
      senderUserId: a.id,
      body: 'Delete me',
    })

    await expect(
      deleteChatMessage(relationship.id, msg.id, b.id),
    ).rejects.toThrow(/sender/i)

    await deleteChatMessage(relationship.id, msg.id, a.id)
    const list = await listChatMessages(relationship.id)
    expect(list).toHaveLength(0)
  })
})
