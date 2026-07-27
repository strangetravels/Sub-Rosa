import { useCallback, useEffect, useState } from 'react'
import {
  ensureDefaultRuleCategories,
  listRuleAcknowledgments,
  listRuleCategories,
  listRules,
  subscribeToDemoRules,
} from '@/features/rules/ruleService'
import { isDemoMode } from '@/lib/firebase/config'
import type { Rule, RuleAcknowledgment, RuleCategory } from '@/types/models'

export type RulesBundle = {
  rules: Rule[]
  categories: RuleCategory[]
  acknowledgments: RuleAcknowledgment[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useRulesData(
  relationshipId: string | undefined,
  options?: { includeArchived?: boolean },
): RulesBundle {
  const includeArchived = options?.includeArchived ?? false
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<RuleCategory[]>([])
  const [acknowledgments, setAcknowledgments] = useState<RuleAcknowledgment[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId))

  const refresh = useCallback(async () => {
    if (!relationshipId) {
      setRules([])
      setCategories([])
      setAcknowledgments([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const cats = await ensureDefaultRuleCategories(relationshipId)
      const [nextRules, nextAcks] = await Promise.all([
        listRules(relationshipId, { includeArchived }),
        listRuleAcknowledgments(relationshipId),
      ])
      setCategories(cats.length ? cats : await listRuleCategories(relationshipId))
      setRules(nextRules)
      setAcknowledgments(nextAcks)
    } finally {
      setLoading(false)
    }
  }, [relationshipId, includeArchived])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!relationshipId || !isDemoMode()) return
    return subscribeToDemoRules(() => {
      void refresh()
    })
  }, [relationshipId, refresh])

  return { rules, categories, acknowledgments, loading, refresh }
}
