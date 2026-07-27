import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import {
  createRelationship,
  joinRelationshipByInvite,
} from '@/features/relationships/relationshipService'
import {
  assignJournalPrompt,
  computeJournalStreak,
  createJournalEntry,
  createJournalPrompt,
  deleteJournalEntry,
  deleteJournalPrompt,
  getDailyPrompt,
  listJournalEntries,
  listJournalPrompts,
  updateJournalEntry,
} from '@/features/journal/journalService'
import { DEFAULT_JOURNAL_ENTRY_POINTS, getPointsBalance } from '@/features/points/pointService'
import { toLocalDateKey } from '@/lib/date'

async function setup(email: string) {
  const user = await signUp(email, 'secret123', 'Journaler')
  const { relationship } = await createRelationship({
    user,
    name: 'Journal Rel',
    role: 'dominant',
    passphrase: 'encrypt-me-please',
  })
  return { user, relationship }
}

describe('journalService', () => {
  it('creates, lists, updates, and deletes entries', async () => {
    const { user, relationship } = await setup('journal-crud@example.com')
    const entry = await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: user.id,
      visibility: 'shared',
      title: 'Day one',
      body: 'Felt good.',
      tags: ['reflection'],
    })
    expect(entry.title).toBe('Day one')
    expect(entry.tags).toEqual(['reflection'])

    let list = await listJournalEntries(relationship.id, user.id)
    expect(list).toHaveLength(1)

    await updateJournalEntry({
      relationshipId: relationship.id,
      entryId: entry.id,
      title: 'Day one (edited)',
    })
    list = await listJournalEntries(relationship.id, user.id)
    expect(list[0].title).toBe('Day one (edited)')

    await deleteJournalEntry(relationship.id, entry.id)
    list = await listJournalEntries(relationship.id, user.id)
    expect(list).toHaveLength(0)
  })

  it('filters private entries from other users', async () => {
    const { user, relationship } = await setup('journal-priv@example.com')
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: user.id,
      visibility: 'private',
      title: 'Secret',
      body: '',
    })
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: user.id,
      visibility: 'shared',
      title: 'Public',
      body: '',
    })

    const fromAuthor = await listJournalEntries(relationship.id, user.id)
    expect(fromAuthor).toHaveLength(2)

    const fromOther = await listJournalEntries(relationship.id, 'other_user')
    expect(fromOther).toHaveLength(1)
    expect(fromOther[0].title).toBe('Public')
  })

  it('creates and deletes custom prompts', async () => {
    const { user, relationship } = await setup('journal-prompt@example.com')
    const prompt = await createJournalPrompt({
      relationshipId: relationship.id,
      text: 'What are you grateful for?',
      category: 'Gratitude',
      createdByUserId: user.id,
    })
    expect(prompt.text).toBe('What are you grateful for?')

    let list = await listJournalPrompts(relationship.id)
    expect(list).toHaveLength(1)

    await deleteJournalPrompt(relationship.id, prompt.id)
    list = await listJournalPrompts(relationship.id)
    expect(list).toHaveLength(0)
  })

  it('assigns a prompt and marks it answered on response', async () => {
    const { user, relationship } = await setup('journal-assign-a@example.com')
    const partner = await signUp('journal-assign-b@example.com', 'secret123', 'Partner')
    await joinRelationshipByInvite({
      user: partner,
      inviteCode: relationship.inviteCode,
      role: 'submissive',
      passphrase: 'encrypt-me-please',
    })

    const assigned = await assignJournalPrompt({
      relationshipId: relationship.id,
      text: 'How was your week?',
      createdByUserId: user.id,
      assignedToUserId: partner.id,
    })
    expect(assigned.status).toBe('open')
    expect(assigned.assignedToUserId).toBe(partner.id)

    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: partner.id,
      visibility: 'shared',
      title: 'How was your week?',
      body: 'Good.',
      promptId: assigned.id,
      assignedByUserId: user.id,
    })

    const prompts = await listJournalPrompts(relationship.id)
    const updated = prompts.find((p) => p.id === assigned.id)
    expect(updated?.status).toBe('answered')
    expect(updated?.answeredEntryId).toBeTruthy()
  })

  it('awards daily journal points once', async () => {
    const { user, relationship } = await setup('journal-pts@example.com')
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: user.id,
      visibility: 'shared',
      title: 'Morning',
      body: 'Hi',
    })
    await createJournalEntry({
      relationshipId: relationship.id,
      authorUserId: user.id,
      visibility: 'shared',
      title: 'Evening',
      body: 'Bye',
    })

    const balance = await getPointsBalance(relationship.id, user.id)
    expect(balance).toBe(DEFAULT_JOURNAL_ENTRY_POINTS)
  })

  it('getDailyPrompt returns deterministically for the same date', () => {
    const a = getDailyPrompt('2026-07-27')
    const b = getDailyPrompt('2026-07-27')
    expect(a).toEqual(b)
    expect(a.text.length).toBeGreaterThan(0)
  })

  it('computes journal streak', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const entries = [
      { authorUserId: 'u1', createdAt: `${toLocalDateKey(today)}T12:00:00.000Z` },
      { authorUserId: 'u1', createdAt: `${toLocalDateKey(yesterday)}T12:00:00.000Z` },
      { authorUserId: 'u1', createdAt: `${toLocalDateKey(twoDaysAgo)}T12:00:00.000Z` },
    ] as any

    expect(computeJournalStreak(entries, 'u1')).toBe(3)
    expect(computeJournalStreak(entries, 'other')).toBe(0)
  })
})
