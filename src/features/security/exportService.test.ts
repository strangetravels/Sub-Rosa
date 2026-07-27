import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import { createHabit } from '@/features/habits/habitService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  buildDemoUserDataExport,
  buildUserDataExport,
  deleteAccountLocal,
} from '@/features/security/exportService'
import { readDemoState } from '@/lib/demo/store'

const PASS = 'encrypt-me-please'

describe('exportService', () => {
  it('exports relationship-scoped demo data for the user', async () => {
    const profile = await signUp('export@example.com', 'secret123', 'Exporter')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Export Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })
    await createHabit({
      relationshipId: relationship.id,
      title: 'Export habit',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })

    const payload = buildDemoUserDataExport(profile)
    expect(payload.user.id).toBe(profile.id)
    expect(payload.relationships.some((r) => r.id === relationship.id)).toBe(true)
    expect(payload.habits.some((h) => h.title === 'Export habit')).toBe(true)

    const asyncPayload = await buildUserDataExport(profile)
    expect(asyncPayload.habits.length).toBeGreaterThan(0)
  })

  it('deletes the demo account and solo relationship data', async () => {
    const profile = await signUp('delete-me@example.com', 'secret123', 'Delete Me')
    const { relationship } = await createRelationship({
      user: profile,
      name: 'Gone Dynamic',
      role: 'submissive',
      passphrase: PASS,
    })
    await createHabit({
      relationshipId: relationship.id,
      title: 'Will vanish',
      frequency: { type: 'daily' },
      assignedToUserId: profile.id,
      createdByUserId: profile.id,
    })

    await deleteAccountLocal(profile)
    const state = readDemoState()
    expect(state.accounts[profile.id]).toBeUndefined()
    expect(state.sessionUserId).toBeNull()
    expect(state.relationships.some((r) => r.id === relationship.id)).toBe(false)
    expect(state.habits.some((h) => h.title === 'Will vanish')).toBe(false)
  })
})
