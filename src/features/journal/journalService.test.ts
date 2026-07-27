import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
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

async function setup() {
  const user = await signUp('journal@example.com', 'secret123', 'Journaler')
  const { relationship } = await createRelationship({
    user,
    name: 'Journal Rel',
    role: 'submissive',
    passphrase: 'encrypt-me-please',
  })
  return { user, relationship }
}

describe('journalService', () => {
  it('creates, lists, updates, and deletes entries', async () => {
    const { user, relationship } = await setup()
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
    const { user, relationship } = await setup()
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
    const { user, relationship } = await setup()
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

  it('getDailyPrompt returns deterministically for the same date', () => {
    const a = getDailyPrompt('2026-07-27')
    const b = getDailyPrompt('2026-07-27')
    expect(a).toEqual(b)
    expect(a.text.length).toBeGreaterThan(0)
  })

  it('computes journal streak', () => {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const entries = [
      { authorUserId: 'u1', createdAt: `${fmt(today)}T12:00:00Z` },
      { authorUserId: 'u1', createdAt: `${fmt(yesterday)}T12:00:00Z` },
      { authorUserId: 'u1', createdAt: `${fmt(twoDaysAgo)}T12:00:00Z` },
    ] as any

    expect(computeJournalStreak(entries, 'u1')).toBe(3)
    expect(computeJournalStreak(entries, 'other')).toBe(0)
  })
})
