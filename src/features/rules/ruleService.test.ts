import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  acknowledgeRule,
  archiveRule,
  createRule,
  createRuleCategory,
  ensureDefaultRuleCategories,
  listRuleAcknowledgments,
  listRuleVersions,
  listRules,
  restoreRule,
  updateRule,
} from '@/features/rules/ruleService'

const PASS = 'encrypt-me-please'

describe('ruleService', () => {
  it('creates rules with version history and acknowledgments', async () => {
    const dom = await signUp('rules-dom@example.com', 'secret123', 'Rules Dom')
    const sub = await signUp('rules-sub@example.com', 'secret123', 'Rules Sub')
    const { relationship } = await createRelationship({
      user: dom,
      name: 'Rules Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })

    const categories = await ensureDefaultRuleCategories(relationship.id)
    expect(categories.length).toBeGreaterThan(0)

    const custom = await createRuleCategory({
      relationshipId: relationship.id,
      label: 'Household',
      color: '#2563eb',
    })

    const created = await createRule({
      relationshipId: relationship.id,
      title: 'Check in nightly',
      body: 'Send a goodnight message before bed.',
      categoryId: custom.id,
      requiresAcknowledgment: true,
      createdByUserId: dom.id,
    })
    expect(created.currentVersion).toBe(1)

    const updated = await updateRule(relationship.id, created.id, {
      title: 'Check in nightly (updated)',
      body: 'Send a goodnight message before 10pm.',
      changeNote: 'Clarified timing',
      editedByUserId: dom.id,
    })
    expect(updated.currentVersion).toBe(2)
    expect(updated.title).toContain('updated')

    const versions = await listRuleVersions(relationship.id, created.id)
    expect(versions).toHaveLength(2)
    expect(versions[0]?.version).toBe(2)
    expect(versions[0]?.changeNote).toBe('Clarified timing')

    await acknowledgeRule({
      relationshipId: relationship.id,
      ruleId: created.id,
      userId: sub.id,
      version: 2,
    })
    const acks = await listRuleAcknowledgments(relationship.id, { ruleId: created.id })
    expect(acks).toHaveLength(1)

    const archived = await archiveRule(relationship.id, created.id)
    expect(archived.status).toBe('archived')
    expect(await listRules(relationship.id)).toHaveLength(0)
    expect(await listRules(relationship.id, { includeArchived: true })).toHaveLength(1)

    const restored = await restoreRule(relationship.id, created.id)
    expect(restored.status).toBe('active')
  })

  it('rejects empty titles and bodies', async () => {
    const user = await signUp('rules-val@example.com', 'secret123', 'Rules Val')
    const { relationship } = await createRelationship({
      user,
      name: 'Validation',
      role: 'switch',
      passphrase: PASS,
    })

    await expect(
      createRule({
        relationshipId: relationship.id,
        title: '   ',
        body: 'text',
        createdByUserId: user.id,
      }),
    ).rejects.toThrow('Title is required.')

    await expect(
      createRule({
        relationshipId: relationship.id,
        title: 'Valid title',
        body: '   ',
        createdByUserId: user.id,
      }),
    ).rejects.toThrow('Rule text is required.')
  })
})
