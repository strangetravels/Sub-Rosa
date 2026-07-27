import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import {
  createRelationship,
  getActiveRelationshipId,
  joinRelationshipByInvite,
  listRelationshipsForUser,
  setActiveRelationshipId,
  subscribeToRelationships,
} from '@/features/relationships/relationshipService'
import type { UserProfile } from '@/types/models'

async function makeUser(email: string, name: string): Promise<UserProfile> {
  return signUp(email, 'secret123', name)
}

describe('relationshipService (demo mode)', () => {
  it('creates a relationship with invite code and activates it', async () => {
    const user = await makeUser('a@example.com', 'Alex')
    const rel = await createRelationship({
      user,
      name: 'Primary dynamic',
      role: 'dominant',
    })

    expect(rel.name).toBe('Primary dynamic')
    expect(rel.inviteCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(rel.members).toHaveLength(1)
    expect(rel.members[0]?.role).toBe('dominant')
    expect(await getActiveRelationshipId(user.id)).toBe(rel.id)
    expect(await listRelationshipsForUser(user.id)).toEqual([rel])
  })

  it('lets a second user join via invite code', async () => {
    const a = await makeUser('dom@example.com', 'Dom')
    const b = await makeUser('sub@example.com', 'Sub')
    const created = await createRelationship({
      user: a,
      name: 'Shared',
      role: 'dominant',
    })

    const joined = await joinRelationshipByInvite({
      user: b,
      inviteCode: created.inviteCode.toLowerCase(),
      role: 'submissive',
    })

    expect(joined.members).toHaveLength(2)
    expect(joined.members.map((m) => m.displayName).sort()).toEqual(['Dom', 'Sub'])
    expect(await getActiveRelationshipId(b.id)).toBe(created.id)
  })

  it('rejects unknown invite codes', async () => {
    const user = await makeUser('x@example.com', 'X')
    await expect(
      joinRelationshipByInvite({ user, inviteCode: 'NOPE12', role: 'switch' }),
    ).rejects.toThrow('Invite code not found.')
  })

  it('rejects a third member', async () => {
    const a = await makeUser('one@example.com', 'One')
    const b = await makeUser('two@example.com', 'Two')
    const c = await makeUser('three@example.com', 'Three')
    const created = await createRelationship({ user: a, name: 'Full', role: 'dominant' })
    await joinRelationshipByInvite({
      user: b,
      inviteCode: created.inviteCode,
      role: 'submissive',
    })

    await expect(
      joinRelationshipByInvite({
        user: c,
        inviteCode: created.inviteCode,
        role: 'switch',
      }),
    ).rejects.toThrow('This relationship already has two members.')
  })

  it('is idempotent when the same user rejoins', async () => {
    const user = await makeUser('solo@example.com', 'Solo')
    const created = await createRelationship({
      user,
      name: 'Mine',
      role: 'switch',
    })
    const again = await joinRelationshipByInvite({
      user,
      inviteCode: created.inviteCode,
      role: 'dominant',
    })
    expect(again.members).toHaveLength(1)
    expect(again.id).toBe(created.id)
  })

  it('switches the active relationship for a user', async () => {
    const user = await makeUser('multi@example.com', 'Multi')
    const first = await createRelationship({ user, name: 'First', role: 'dominant' })
    const second = await createRelationship({ user, name: 'Second', role: 'switch' })

    expect(await getActiveRelationshipId(user.id)).toBe(second.id)
    await setActiveRelationshipId(user.id, first.id)
    expect(await getActiveRelationshipId(user.id)).toBe(first.id)
  })

  it('notifies relationship subscribers', async () => {
    const user = await makeUser('listen@example.com', 'Listen')
    const updates: Array<{ count: number; activeId: string | null }> = []

    await new Promise<void>((resolve) => {
      const unsubscribe = subscribeToRelationships(user.id, (relationships, activeId) => {
        updates.push({ count: relationships.length, activeId })
        if (relationships.length === 1) {
          unsubscribe()
          resolve()
        }
      })
      void createRelationship({ user, name: 'Watched', role: 'dominant' })
    })

    expect(updates.some((u) => u.count === 0)).toBe(true)
    expect(updates.some((u) => u.count === 1 && u.activeId)).toBe(true)
  })
})
