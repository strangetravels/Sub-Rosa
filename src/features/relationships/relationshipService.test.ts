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

const PASS = 'encrypt-me-please'

async function makeUser(email: string, name: string): Promise<UserProfile> {
  return signUp(email, 'secret123', name)
}

describe('relationshipService (demo mode)', () => {
  it('creates a relationship with invite code, crypto, and activates it', async () => {
    const user = await makeUser('a@example.com', 'Alex')
    const { relationship: rel, recoveryPhrase } = await createRelationship({
      user,
      name: 'Primary dynamic',
      role: 'dominant',
      passphrase: PASS,
    })

    expect(rel.name).toBe('Primary dynamic')
    expect(rel.inviteCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(rel.members).toHaveLength(1)
    expect(rel.members[0]?.role).toBe('dominant')
    expect(rel.crypto?.wrappedContentKeys[user.id]).toBeTruthy()
    expect(rel.crypto?.identityPublicKeys[user.id]).toBeTruthy()
    expect(recoveryPhrase.split(' ')).toHaveLength(12)
    expect(await getActiveRelationshipId(user.id)).toBe(rel.id)
    expect(await listRelationshipsForUser(user.id)).toEqual([rel])
  })

  it('lets a second user join via invite code with ECDH crypto', async () => {
    const a = await makeUser('dom@example.com', 'Dom')
    const b = await makeUser('sub@example.com', 'Sub')
    const { relationship: created } = await createRelationship({
      user: a,
      name: 'Shared',
      role: 'dominant',
      passphrase: PASS,
    })

    const { relationship: joined, safetyNumber, awaitingKeyDelivery } =
      await joinRelationshipByInvite({
        user: b,
        inviteCode: created.inviteCode.toLowerCase(),
        role: 'submissive',
        passphrase: `${PASS}-b`,
      })

    expect(joined.members).toHaveLength(2)
    expect(joined.members.map((m) => m.displayName).sort()).toEqual(['Dom', 'Sub'])
    expect(await getActiveRelationshipId(b.id)).toBe(created.id)
    expect(safetyNumber.replace(/\s/g, '')).toMatch(/^\d{30}$/)
    expect(awaitingKeyDelivery).toBe(false)
    expect(joined.crypto?.wrappedContentKeys[b.id]).toBeTruthy()
  })

  it('rejects unknown invite codes', async () => {
    const user = await makeUser('x@example.com', 'X')
    await expect(
      joinRelationshipByInvite({
        user,
        inviteCode: 'NOPE12',
        role: 'switch',
        passphrase: PASS,
      }),
    ).rejects.toThrow('Invite code not found.')
  })

  it('rejects a third member', async () => {
    const a = await makeUser('one@example.com', 'One')
    const b = await makeUser('two@example.com', 'Two')
    const c = await makeUser('three@example.com', 'Three')
    const { relationship: created } = await createRelationship({
      user: a,
      name: 'Full',
      role: 'dominant',
      passphrase: PASS,
    })
    await joinRelationshipByInvite({
      user: b,
      inviteCode: created.inviteCode,
      role: 'submissive',
      passphrase: PASS,
    })

    await expect(
      joinRelationshipByInvite({
        user: c,
        inviteCode: created.inviteCode,
        role: 'switch',
        passphrase: PASS,
      }),
    ).rejects.toThrow('This relationship already has two members.')
  })

  it('is idempotent when the same user rejoins', async () => {
    const user = await makeUser('solo@example.com', 'Solo')
    const { relationship: created } = await createRelationship({
      user,
      name: 'Mine',
      role: 'switch',
      passphrase: PASS,
    })
    const { relationship: again } = await joinRelationshipByInvite({
      user,
      inviteCode: created.inviteCode,
      role: 'dominant',
      passphrase: PASS,
    })
    expect(again.members).toHaveLength(1)
    expect(again.id).toBe(created.id)
  })

  it('switches the active relationship for a user', async () => {
    const user = await makeUser('multi@example.com', 'Multi')
    const { relationship: first } = await createRelationship({
      user,
      name: 'First',
      role: 'dominant',
      passphrase: PASS,
    })
    const { relationship: second } = await createRelationship({
      user,
      name: 'Second',
      role: 'switch',
      passphrase: PASS,
    })

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
      void createRelationship({
        user,
        name: 'Watched',
        role: 'dominant',
        passphrase: PASS,
      })
    })

    expect(updates.some((u) => u.count === 0)).toBe(true)
    expect(updates.some((u) => u.count === 1 && u.activeId)).toBe(true)
  })
})
