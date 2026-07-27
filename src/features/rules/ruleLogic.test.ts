import { describe, expect, it } from 'vitest'
import {
  countPendingAcknowledgments,
  hasAcknowledgedVersion,
  memberMustAcknowledgeRule,
  ruleNeedsAcknowledgmentFrom,
} from '@/features/rules/ruleLogic'
import type { Rule, RuleAcknowledgment } from '@/types/models'

function rule(partial: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_1',
    relationshipId: 'rel_1',
    title: 'Curfew',
    body: 'Be home by ten.',
    categoryId: null,
    requiresAcknowledgment: true,
    currentVersion: 2,
    status: 'active',
    createdByUserId: 'dom_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('ruleLogic', () => {
  it('requires acknowledgment from submissive and switch roles', () => {
    expect(memberMustAcknowledgeRule('submissive')).toBe(true)
    expect(memberMustAcknowledgeRule('switch')).toBe(true)
    expect(memberMustAcknowledgeRule('dominant')).toBe(false)
  })

  it('detects missing acknowledgment for current version', () => {
    const acknowledgments: RuleAcknowledgment[] = [
      {
        id: 'ack_1',
        ruleId: 'rule_1',
        relationshipId: 'rel_1',
        userId: 'sub_1',
        version: 1,
        acknowledgedAt: new Date().toISOString(),
      },
    ]
    expect(hasAcknowledgedVersion(acknowledgments, 'rule_1', 'sub_1', 2)).toBe(false)
    expect(
      ruleNeedsAcknowledgmentFrom(rule(), 'sub_1', 'submissive', acknowledgments),
    ).toBe(true)
  })

  it('counts pending acknowledgments for a member', () => {
    const rules = [rule(), rule({ id: 'rule_2', requiresAcknowledgment: false })]
    const count = countPendingAcknowledgments(rules, 'sub_1', {
      userId: 'sub_1',
      role: 'submissive',
      displayName: 'Sub',
    }, [])
    expect(count).toBe(1)
  })
})
