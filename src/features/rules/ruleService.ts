import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import type {
  Rule,
  RuleAcknowledgment,
  RuleCategory,
  RuleStatus,
  RuleVersion,
} from '@/types/models'

const RULES_CHANGED = 'subrosa-demo-rules'

export function notifyDemoRulesChanged(): void {
  window.dispatchEvent(new Event(RULES_CHANGED))
}

export function subscribeToDemoRules(listener: () => void): () => void {
  window.addEventListener(RULES_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(RULES_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

const DEFAULT_CATEGORIES: Array<{ label: string; color: string }> = [
  { label: 'Protocol', color: '#e11d48' },
  { label: 'Behavior', color: '#a855f7' },
  { label: 'Communication', color: '#2563eb' },
  { label: 'Limits', color: '#78716c' },
]

export async function ensureDefaultRuleCategories(
  relationshipId: string,
): Promise<RuleCategory[]> {
  const existing = await listRuleCategories(relationshipId)
  if (existing.length > 0) return existing

  const created: RuleCategory[] = DEFAULT_CATEGORIES.map((c) => ({
    id: createId('rcat'),
    relationshipId,
    label: c.label,
    color: c.color,
  }))

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      ruleCategories: [...state.ruleCategories, ...created],
    }))
    notifyDemoRulesChanged()
    return created
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await Promise.all(
    created.map((cat) =>
      setDoc(doc(db, 'relationships', relationshipId, 'ruleCategories', cat.id), cat),
    ),
  )
  return created
}

export async function listRuleCategories(relationshipId: string): Promise<RuleCategory[]> {
  if (isDemoMode()) {
    return readDemoState().ruleCategories.filter((c) => c.relationshipId === relationshipId)
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(
    collection(db, 'relationships', relationshipId, 'ruleCategories'),
  )
  return snap.docs.map((d) => d.data() as RuleCategory)
}

export async function createRuleCategory(input: {
  relationshipId: string
  label: string
  color: string
}): Promise<RuleCategory> {
  const label = input.label.trim()
  if (!label) throw new Error('Category name is required.')
  const color = input.color.trim() || '#78716c'

  const category: RuleCategory = {
    id: createId('rcat'),
    relationshipId: input.relationshipId,
    label,
    color,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      ruleCategories: [...state.ruleCategories, category],
    }))
    notifyDemoRulesChanged()
    return category
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'ruleCategories', category.id),
    category,
  )
  return category
}

export async function listRules(
  relationshipId: string,
  options?: { includeArchived?: boolean },
): Promise<Rule[]> {
  const includeArchived = options?.includeArchived ?? false
  if (isDemoMode()) {
    return readDemoState()
      .rules.filter((r) => r.relationshipId === relationshipId)
      .filter((r) => includeArchived || r.status === 'active')
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'rules'))
  return snap.docs
    .map((d) => d.data() as Rule)
    .filter((r) => includeArchived || r.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function listRuleVersions(
  relationshipId: string,
  ruleId: string,
): Promise<RuleVersion[]> {
  if (isDemoMode()) {
    return readDemoState()
      .ruleVersions.filter((v) => v.relationshipId === relationshipId && v.ruleId === ruleId)
      .sort((a, b) => b.version - a.version)
  }

  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(
    query(
      collection(db, 'relationships', relationshipId, 'ruleVersions'),
      where('ruleId', '==', ruleId),
    ),
  )
  return snap.docs.map((d) => d.data() as RuleVersion).sort((a, b) => b.version - a.version)
}

export async function listRuleAcknowledgments(
  relationshipId: string,
  options?: { ruleId?: string },
): Promise<RuleAcknowledgment[]> {
  if (isDemoMode()) {
    return readDemoState()
      .ruleAcknowledgments.filter((a) => a.relationshipId === relationshipId)
      .filter((a) => (options?.ruleId ? a.ruleId === options.ruleId : true))
  }

  const db = getFirebaseDb()
  if (!db) return []
  let q = query(collection(db, 'relationships', relationshipId, 'ruleAcknowledgments'))
  if (options?.ruleId) {
    q = query(q, where('ruleId', '==', options.ruleId))
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as RuleAcknowledgment)
}

function buildVersion(input: {
  ruleId: string
  relationshipId: string
  version: number
  title: string
  body: string
  categoryId: string | null
  requiresAcknowledgment: boolean
  editedByUserId: string
  changeNote?: string
}): RuleVersion {
  return {
    id: createId('rver'),
    ruleId: input.ruleId,
    relationshipId: input.relationshipId,
    version: input.version,
    title: input.title,
    body: input.body,
    categoryId: input.categoryId,
    requiresAcknowledgment: input.requiresAcknowledgment,
    linkedPunishmentId: null,
    editedByUserId: input.editedByUserId,
    editedAt: new Date().toISOString(),
    changeNote: input.changeNote?.trim() || undefined,
  }
}

export type CreateRuleInput = {
  relationshipId: string
  title: string
  body: string
  categoryId?: string | null
  requiresAcknowledgment?: boolean
  createdByUserId: string
}

export async function createRule(input: CreateRuleInput): Promise<Rule> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  const body = input.body.trim()
  if (!body) throw new Error('Rule text is required.')

  const now = new Date().toISOString()
  const ruleId = createId('rule')
  const version = buildVersion({
    ruleId,
    relationshipId: input.relationshipId,
    version: 1,
    title,
    body,
    categoryId: input.categoryId ?? null,
    requiresAcknowledgment: input.requiresAcknowledgment ?? true,
    editedByUserId: input.createdByUserId,
    changeNote: 'Initial version',
  })

  const rule: Rule = {
    id: ruleId,
    relationshipId: input.relationshipId,
    title,
    body,
    categoryId: input.categoryId ?? null,
    requiresAcknowledgment: version.requiresAcknowledgment,
    linkedPunishmentId: null,
    currentVersion: 1,
    status: 'active',
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      rules: [...state.rules, rule],
      ruleVersions: [...state.ruleVersions, version],
    }))
    notifyDemoRulesChanged()
    return rule
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', rule.relationshipId, 'rules', rule.id), rule)
  await setDoc(
    doc(db, 'relationships', rule.relationshipId, 'ruleVersions', version.id),
    version,
  )
  return rule
}

export type UpdateRuleInput = {
  title?: string
  body?: string
  categoryId?: string | null
  requiresAcknowledgment?: boolean
  changeNote?: string
  editedByUserId: string
}

export async function updateRule(
  relationshipId: string,
  ruleId: string,
  patch: UpdateRuleInput,
): Promise<Rule> {
  if (isDemoMode()) {
    let updated: Rule | null = null
    let nextVersion: RuleVersion | null = null
    updateDemoState((state) => {
      const rules = state.rules.map((r) => {
        if (r.id !== ruleId || r.relationshipId !== relationshipId) return r
        const title = patch.title !== undefined ? patch.title.trim() || r.title : r.title
        const body = patch.body !== undefined ? patch.body.trim() || r.body : r.body
        const categoryId = patch.categoryId !== undefined ? patch.categoryId : r.categoryId
        const requiresAcknowledgment =
          patch.requiresAcknowledgment !== undefined
            ? patch.requiresAcknowledgment
            : r.requiresAcknowledgment
        const nextVersionNumber = r.currentVersion + 1
        nextVersion = buildVersion({
          ruleId,
          relationshipId,
          version: nextVersionNumber,
          title,
          body,
          categoryId,
          requiresAcknowledgment,
          editedByUserId: patch.editedByUserId,
          changeNote: patch.changeNote,
        })
        updated = {
          ...r,
          title,
          body,
          categoryId,
          requiresAcknowledgment,
          currentVersion: nextVersionNumber,
          updatedAt: new Date().toISOString(),
        }
        return updated
      })
      return {
        ...state,
        rules,
        ruleVersions: nextVersion ? [...state.ruleVersions, nextVersion] : state.ruleVersions,
      }
    })
    notifyDemoRulesChanged()
    if (!updated) throw new Error('Rule not found.')
    return updated
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const ref = doc(db, 'relationships', relationshipId, 'rules', ruleId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Rule not found.')
  const current = snap.data() as Rule

  const title = patch.title !== undefined ? patch.title.trim() || current.title : current.title
  const body = patch.body !== undefined ? patch.body.trim() || current.body : current.body
  const categoryId = patch.categoryId !== undefined ? patch.categoryId : current.categoryId
  const requiresAcknowledgment =
    patch.requiresAcknowledgment !== undefined
      ? patch.requiresAcknowledgment
      : current.requiresAcknowledgment
  const nextVersionNumber = current.currentVersion + 1
  const version = buildVersion({
    ruleId,
    relationshipId,
    version: nextVersionNumber,
    title,
    body,
    categoryId,
    requiresAcknowledgment,
    editedByUserId: patch.editedByUserId,
    changeNote: patch.changeNote,
  })

  const updated: Rule = {
    ...current,
    title,
    body,
    categoryId,
    requiresAcknowledgment,
    currentVersion: nextVersionNumber,
    updatedAt: new Date().toISOString(),
  }

  await setDoc(
    doc(db, 'relationships', relationshipId, 'ruleVersions', version.id),
    version,
  )
  await updateDoc(ref, {
    title: updated.title,
    body: updated.body,
    categoryId: updated.categoryId,
    requiresAcknowledgment: updated.requiresAcknowledgment,
    currentVersion: updated.currentVersion,
    updatedAt: updated.updatedAt,
  })
  return updated
}

export async function archiveRule(relationshipId: string, ruleId: string): Promise<Rule> {
  return setRuleStatus(relationshipId, ruleId, 'archived')
}

export async function restoreRule(relationshipId: string, ruleId: string): Promise<Rule> {
  return setRuleStatus(relationshipId, ruleId, 'active')
}

async function setRuleStatus(
  relationshipId: string,
  ruleId: string,
  status: RuleStatus,
): Promise<Rule> {
  if (isDemoMode()) {
    let updated: Rule | null = null
    updateDemoState((state) => {
      const rules = state.rules.map((r) => {
        if (r.id !== ruleId || r.relationshipId !== relationshipId) return r
        updated = { ...r, status, updatedAt: new Date().toISOString() }
        return updated
      })
      return { ...state, rules }
    })
    notifyDemoRulesChanged()
    if (!updated) throw new Error('Rule not found.')
    return updated
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const ref = doc(db, 'relationships', relationshipId, 'rules', ruleId)
  await updateDoc(ref, { status, updatedAt: new Date().toISOString() })
  const fresh = await getDoc(ref)
  if (!fresh.exists()) throw new Error('Rule not found.')
  return fresh.data() as Rule
}

export async function acknowledgeRule(input: {
  relationshipId: string
  ruleId: string
  userId: string
  version: number
}): Promise<RuleAcknowledgment> {
  const existing = (await listRuleAcknowledgments(input.relationshipId, { ruleId: input.ruleId }))
    .find(
      (a) =>
        a.userId === input.userId &&
        a.version === input.version &&
        a.ruleId === input.ruleId,
    )
  if (existing) return existing

  const ack: RuleAcknowledgment = {
    id: createId('rack'),
    ruleId: input.ruleId,
    relationshipId: input.relationshipId,
    userId: input.userId,
    version: input.version,
    acknowledgedAt: new Date().toISOString(),
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      ruleAcknowledgments: [...state.ruleAcknowledgments, ack],
    }))
    notifyDemoRulesChanged()
    return ack
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'ruleAcknowledgments', ack.id),
    ack,
  )
  return ack
}
