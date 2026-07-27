import type { RelationshipMember, RelationshipRole, Rule, RuleAcknowledgment } from '@/types/models'

const ACK_ROLES: RelationshipRole[] = ['submissive', 'switch']

export function memberMustAcknowledgeRule(role: RelationshipRole): boolean {
  return ACK_ROLES.includes(role)
}

export function hasAcknowledgedVersion(
  acknowledgments: RuleAcknowledgment[],
  ruleId: string,
  userId: string,
  version: number,
): boolean {
  return acknowledgments.some(
    (a) => a.ruleId === ruleId && a.userId === userId && a.version === version,
  )
}

export function ruleNeedsAcknowledgmentFrom(
  rule: Rule,
  userId: string,
  role: RelationshipRole,
  acknowledgments: RuleAcknowledgment[],
): boolean {
  if (!rule.requiresAcknowledgment || rule.status !== 'active') return false
  if (!memberMustAcknowledgeRule(role)) return false
  return !hasAcknowledgedVersion(acknowledgments, rule.id, userId, rule.currentVersion)
}

export function countPendingAcknowledgments(
  rules: Rule[],
  userId: string,
  member: RelationshipMember | undefined,
  acknowledgments: RuleAcknowledgment[],
): number {
  if (!member) return 0
  return rules.filter((rule) =>
    ruleNeedsAcknowledgmentFrom(rule, userId, member.role, acknowledgments),
  ).length
}
