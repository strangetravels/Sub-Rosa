import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  ruleNeedsAcknowledgmentFrom,
} from '@/features/rules/ruleLogic'
import {
  acknowledgeRule,
  archiveRule,
  createRule,
  createRuleCategory,
  listRuleVersions,
  restoreRule,
  updateRule,
} from '@/features/rules/ruleService'
import { useRulesData } from '@/features/rules/useRulesData'
import { formatLocalDateKey } from '@/lib/date'
import type { Rule, RuleVersion } from '@/types/models'

const CATEGORY_COLORS = [
  '#e11d48',
  '#a855f7',
  '#2563eb',
  '#78716c',
  '#0d9488',
  '#ea580c',
  '#ca8a04',
] as const

function emptyForm() {
  return {
    title: '',
    body: '',
    categoryId: '' as string,
    requiresAcknowledgment: true,
    changeNote: '',
  }
}

export function RulesPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const myMember = activeRelationship?.members.find((m) => m.userId === user?.id)

  const { rules, categories, acknowledgments, loading, refresh } = useRulesData(relationshipId, {
    includeArchived: true,
  })

  const [showArchived, setShowArchived] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [versionsByRule, setVersionsByRule] = useState<Record<string, RuleVersion[]>>({})
  const [form, setForm] = useState(emptyForm)
  const [categoryLabel, setCategoryLabel] = useState('')
  const [categoryColor, setCategoryColor] = useState<string>(CATEGORY_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const visibleRules = useMemo(() => {
    return rules
      .filter((r) => (showArchived ? true : r.status === 'active'))
      .filter((r) => (categoryFilter === 'all' ? true : r.categoryId === categoryFilter))
  }, [rules, showArchived, categoryFilter])

  const pendingCount = useMemo(() => {
    if (!user || !myMember) return 0
    return rules.filter((rule) =>
      ruleNeedsAcknowledgmentFrom(rule, user.id, myMember.role, acknowledgments),
    ).length
  }, [rules, user, myMember, acknowledgments])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id)
    setForm({
      title: rule.title,
      body: rule.body,
      categoryId: rule.categoryId ?? '',
      requiresAcknowledgment: rule.requiresAcknowledgment,
      changeNote: '',
    })
    setError(null)
  }

  async function saveRule() {
    if (!user || !relationshipId) return
    setBusy(true)
    setError(null)
    try {
      if (editingId) {
        await updateRule(relationshipId, editingId, {
          title: form.title,
          body: form.body,
          categoryId: form.categoryId || null,
          requiresAcknowledgment: form.requiresAcknowledgment,
          changeNote: form.changeNote,
          editedByUserId: user.id,
        })
      } else {
        await createRule({
          relationshipId,
          title: form.title,
          body: form.body,
          categoryId: form.categoryId || null,
          requiresAcknowledgment: form.requiresAcknowledgment,
          createdByUserId: user.id,
        })
      }
      startCreate()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rule.')
    } finally {
      setBusy(false)
    }
  }

  async function saveCategory() {
    if (!relationshipId) return
    setCategoryError(null)
    try {
      const created = await createRuleCategory({
        relationshipId,
        label: categoryLabel,
        color: categoryColor,
      })
      setCategoryLabel('')
      setForm((f) => ({ ...f, categoryId: created.id }))
      await refresh()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Could not create category.')
    }
  }

  async function toggleHistory(ruleId: string) {
    if (expandedId === ruleId) {
      setExpandedId(null)
      return
    }
    if (!relationshipId) return
    const versions = await listRuleVersions(relationshipId, ruleId)
    setVersionsByRule((prev) => ({ ...prev, [ruleId]: versions }))
    setExpandedId(ruleId)
  }

  async function ackRule(rule: Rule) {
    if (!user || !relationshipId) return
    await acknowledgeRule({
      relationshipId,
      ruleId: rule.id,
      userId: user.id,
      version: rule.currentVersion,
    })
    await refresh()
  }

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Rules</h2>
        <p className="mt-2 text-stone-400">Select an active relationship to manage rules.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Rules</h2>
        <p className="mt-2 text-stone-400">
          Versioned rule library for {activeRelationship.name}. Edits create a new version so
          nothing changes silently.
        </p>
        {pendingCount > 0 ? (
          <p className="mt-2 text-sm text-amber-300">
            {pendingCount} rule{pendingCount === 1 ? '' : 's'} waiting for your acknowledgment.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Categories</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 px-2 py-1 text-xs text-stone-300"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.label}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block min-w-[10rem] flex-1 text-sm text-stone-300">
            New category
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              maxLength={40}
            />
          </label>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                className={[
                  'h-7 w-7 rounded-md border',
                  categoryColor === color ? 'border-stone-100' : 'border-stone-700',
                ].join(' ')}
                style={{ backgroundColor: color }}
                onClick={() => setCategoryColor(color)}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!categoryLabel.trim()}
            className="rounded-md border border-stone-600 px-3 py-2 text-sm text-stone-300 hover:border-stone-400 disabled:opacity-50"
            onClick={() => void saveCategory()}
          >
            Add category
          </button>
        </div>
        {categoryError ? <p className="mt-2 text-sm text-rose-400">{categoryError}</p> : null}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">
          {editingId ? 'Edit rule' : 'New rule'}
        </h3>

        <label className="mt-4 block text-sm text-stone-300">
          Title
          <input
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={120}
          />
        </label>

        <label className="mt-3 block text-sm text-stone-300">
          Rule text
          <textarea
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            rows={5}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </label>

        <label className="mt-3 block text-sm text-stone-300">
          Category
          <select
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={form.requiresAcknowledgment}
            onChange={(e) =>
              setForm((f) => ({ ...f, requiresAcknowledgment: e.target.checked }))
            }
          />
          Require partner acknowledgment after changes
        </label>

        {editingId ? (
          <label className="mt-3 block text-sm text-stone-300">
            Change note
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={form.changeNote}
              onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))}
              placeholder="What changed and why?"
              maxLength={200}
            />
          </label>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !form.title.trim() || !form.body.trim()}
            className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-50"
            onClick={() => void saveRule()}
          >
            {editingId ? 'Save new version' : 'Create rule'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
              onClick={startCreate}
            >
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-stone-200">Rule library</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
            <label>
              Category
              <select
                className="ml-2 rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-stone-200 outline-none focus:border-rose-500"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                className="mr-1.5"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">Loading…</p>
        ) : visibleRules.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No rules yet. Create one above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visibleRules.map((rule) => {
              const category = categories.find((c) => c.id === rule.categoryId)
              const creator = activeRelationship.members.find(
                (m) => m.userId === rule.createdByUserId,
              )
              const needsAck =
                myMember &&
                ruleNeedsAcknowledgmentFrom(rule, user.id, myMember.role, acknowledgments)
              const versions = versionsByRule[rule.id] ?? []

              return (
                <li
                  key={rule.id}
                  className="rounded-lg border border-stone-700 bg-stone-900/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {category ? (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: category.color }}
                            title={category.label}
                          />
                        ) : null}
                        <p className="font-medium text-stone-100">{rule.title}</p>
                        <span className="text-xs text-stone-500">v{rule.currentVersion}</span>
                        {rule.status === 'archived' ? (
                          <span className="text-xs text-stone-500">Archived</span>
                        ) : null}
                        {needsAck ? (
                          <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-300">
                            Needs acknowledgment
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-stone-300">{rule.body}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        {category?.label ?? 'Uncategorized'}
                        {' · '}
                        by {creator?.displayName ?? 'Unknown'}
                        {rule.requiresAcknowledgment ? ' · acknowledgment required' : ''}
                      </p>
                    </div>
                    {needsAck ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-amber-700 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200 hover:border-amber-500"
                        onClick={() => void ackRule(rule)}
                      >
                        Acknowledge
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {rule.status === 'active' ? (
                      <>
                        <button
                          type="button"
                          className="text-stone-400 hover:text-stone-200"
                          onClick={() => startEdit(rule)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-stone-400 hover:text-rose-300"
                          onClick={() => {
                            void archiveRule(rule.relationshipId, rule.id).then(refresh)
                          }}
                        >
                          Archive
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-stone-400 hover:text-stone-200"
                        onClick={() => {
                          void restoreRule(rule.relationshipId, rule.id).then(refresh)
                        }}
                      >
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-stone-400 hover:text-stone-200"
                      onClick={() => void toggleHistory(rule.id)}
                    >
                      {expandedId === rule.id ? 'Hide history' : 'Version history'}
                    </button>
                  </div>

                  {expandedId === rule.id ? (
                    <div className="mt-4 border-t border-stone-800 pt-4">
                      {versions.length === 0 ? (
                        <p className="text-sm text-stone-500">Loading versions…</p>
                      ) : (
                        <ul className="space-y-3">
                          {versions.map((version) => {
                            const editor = activeRelationship.members.find(
                              (m) => m.userId === version.editedByUserId,
                            )
                            return (
                              <li
                                key={version.id}
                                className="rounded-md border border-stone-800 bg-stone-950/40 p-3 text-sm"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  <span className="text-stone-300">v{version.version}</span>
                                  <span>
                                    {formatLocalDateKey(version.editedAt.slice(0, 10))}
                                  </span>
                                  <span>{editor?.displayName ?? 'Unknown'}</span>
                                  {version.version === rule.currentVersion ? (
                                    <span className="text-rose-400">current</span>
                                  ) : null}
                                </div>
                                <p className="mt-2 font-medium text-stone-200">{version.title}</p>
                                <p className="mt-1 whitespace-pre-wrap text-stone-400">
                                  {version.body}
                                </p>
                                {version.changeNote ? (
                                  <p className="mt-2 text-xs text-stone-500">
                                    Note: {version.changeNote}
                                  </p>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
