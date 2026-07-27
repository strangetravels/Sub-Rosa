import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  assignJournalPrompt,
  computeJournalStreak,
  createJournalEntry,
  createJournalPrompt,
  DECRYPT_FAILED_TEXT,
  deleteJournalEntry,
  deleteJournalPrompt,
  getDailyPrompt,
  LOCKED_TEXT,
  updateJournalEntry,
} from '@/features/journal/journalService'
import { useJournalData } from '@/features/journal/useJournalData'
import { formatLocalDateKey, toLocalDateKey } from '@/lib/date'
import type { JournalEntry, JournalEntryVisibility, JournalPrompt } from '@/types/models'

function isLockedText(value: string): boolean {
  return value === LOCKED_TEXT || value === DECRYPT_FAILED_TEXT
}

const TAG_SUGGESTIONS = ['reflection', 'gratitude', 'scene', 'growth', 'connection', 'check-in']

export function JournalPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const { entries, prompts, loading, refresh } = useJournalData(relationshipId, user?.id)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [respondingTo, setRespondingTo] = useState<JournalPrompt | null>(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    visibility: 'shared' as JournalEntryVisibility,
    tags: '',
    promptId: '',
    assignedByUserId: '' as string | null,
  })
  const [error, setError] = useState<string | null>(null)

  const [showPromptForm, setShowPromptForm] = useState(false)
  const [promptForm, setPromptForm] = useState({ text: '', category: '' })

  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignForm, setAssignForm] = useState({ text: '', assigneeId: '' })

  const [filterMine, setFilterMine] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const todayPrompt = useMemo(() => getDailyPrompt(toLocalDateKey()), [])

  const streak = useMemo(
    () => (user ? computeJournalStreak(entries, user.id) : 0),
    [entries, user],
  )

  const partners = useMemo(
    () => (activeRelationship?.members.filter((m) => m.userId !== user?.id) ?? []),
    [activeRelationship, user],
  )

  const pendingAssigned = useMemo(
    () =>
      prompts.filter(
        (p) =>
          p.assignedToUserId === user?.id &&
          p.status === 'open' &&
          Boolean(p.assignedToUserId),
      ),
    [prompts, user],
  )

  const customPrompts = useMemo(
    () => prompts.filter((p) => !p.assignedToUserId),
    [prompts],
  )

  const assignedByMe = useMemo(
    () =>
      prompts.filter(
        (p) => p.assignedToUserId && p.createdByUserId === user?.id,
      ),
    [prompts, user],
  )

  const filteredEntries = useMemo(() => {
    let result = entries
    if (filterMine && user) {
      result = result.filter((e) => e.authorUserId === user.id)
    }
    if (filterTag) {
      result = result.filter((e) => e.tags.includes(filterTag))
    }
    if (filterDate) {
      result = result.filter((e) => e.createdAt.slice(0, 10) === filterDate)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q),
      )
    }
    return result
  }, [entries, filterMine, filterTag, filterDate, searchQuery, user])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) for (const t of e.tags) set.add(t)
    return [...set].sort()
  }, [entries])

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Journal</h2>
        <p className="mt-2 text-stone-400">Select an active relationship first.</p>
      </section>
    )
  }

  function resetForm() {
    setForm({
      title: '',
      body: '',
      visibility: 'shared',
      tags: '',
      promptId: '',
      assignedByUserId: null,
    })
    setEditingId(null)
    setRespondingTo(null)
    setShowForm(false)
    setError(null)
  }

  function startEdit(entry: JournalEntry) {
    setForm({
      title: entry.title,
      body: entry.body,
      visibility: entry.visibility,
      tags: entry.tags.join(', '),
      promptId: entry.promptId ?? '',
      assignedByUserId: entry.assignedByUserId ?? null,
    })
    setEditingId(entry.id)
    setRespondingTo(null)
    setShowForm(true)
    setError(null)
  }

  function usePromptAsTitle(text: string) {
    setForm((f) => ({ ...f, title: text, promptId: '', assignedByUserId: null }))
    setRespondingTo(null)
    setEditingId(null)
    setShowForm(true)
  }

  function startRespond(prompt: JournalPrompt) {
    setForm({
      title: prompt.text,
      body: '',
      visibility: 'shared',
      tags: '',
      promptId: prompt.id,
      assignedByUserId: prompt.createdByUserId,
    })
    setRespondingTo(prompt)
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  async function handleSubmit() {
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      if (editingId) {
        await updateJournalEntry({
          relationshipId: activeRelationship!.id,
          entryId: editingId,
          title: form.title,
          body: form.body,
          visibility: form.visibility,
          tags,
        })
      } else {
        await createJournalEntry({
          relationshipId: activeRelationship!.id,
          authorUserId: user!.id,
          visibility: form.visibility,
          title: form.title,
          body: form.body,
          tags,
          promptId: form.promptId || null,
          assignedByUserId: form.assignedByUserId || null,
        })
      }
      resetForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.')
    }
  }

  async function handleDelete(entryId: string) {
    await deleteJournalEntry(activeRelationship!.id, entryId)
    await refresh()
  }

  async function handleAddPrompt() {
    try {
      await createJournalPrompt({
        relationshipId: activeRelationship!.id,
        text: promptForm.text,
        category: promptForm.category,
        createdByUserId: user!.id,
      })
      setPromptForm({ text: '', category: '' })
      setShowPromptForm(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prompt.')
    }
  }

  async function handleAssign() {
    try {
      const assigneeId = assignForm.assigneeId || partners[0]?.userId
      if (!assigneeId) throw new Error('No partner to assign to.')
      await assignJournalPrompt({
        relationshipId: activeRelationship!.id,
        text: assignForm.text,
        createdByUserId: user!.id,
        assignedToUserId: assigneeId,
      })
      setAssignForm({ text: '', assigneeId: '' })
      setShowAssignForm(false)
      setError(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign prompt.')
    }
  }

  async function handleDeletePrompt(promptId: string) {
    await deleteJournalPrompt(activeRelationship!.id, promptId)
    await refresh()
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Journal</h2>
        <p className="mt-2 text-stone-400">
          Private or shared entries. First entry each day earns points. Bodies encrypt when the
          content key is unlocked.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Streak</p>
          <p className="mt-1 text-2xl font-semibold text-stone-50">{streak}</p>
        </div>
        <div className="flex-1 rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Today&apos;s prompt · {todayPrompt.category}
          </p>
          <p className="mt-1 text-sm text-stone-200">{todayPrompt.text}</p>
          <button
            type="button"
            className="mt-2 text-xs text-rose-400 hover:text-rose-300"
            onClick={() => usePromptAsTitle(todayPrompt.text)}
          >
            Use as entry title
          </button>
        </div>
      </div>

      {pendingAssigned.length > 0 ? (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-200">Assigned to you</p>
          <ul className="mt-2 space-y-2">
            {pendingAssigned.map((p) => {
              const from = activeRelationship.members.find((m) => m.userId === p.createdByUserId)
              return (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-amber-900/40 bg-stone-950/40 p-3"
                >
                  <div>
                    <p className="text-sm text-stone-100">{p.text}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      from {from?.displayName ?? 'Partner'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-rose-700 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-200 hover:border-rose-500"
                    onClick={() => startRespond(p)}
                  >
                    Respond
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {!showForm ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            New entry
          </button>
          {partners.length > 0 ? (
            <button
              type="button"
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
              onClick={() => setShowAssignForm((v) => !v)}
            >
              Assign prompt
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-stone-700 bg-stone-900/50 p-5">
          <h3 className="text-sm font-medium text-stone-200">
            {editingId
              ? 'Edit entry'
              : respondingTo
                ? 'Respond to assigned prompt'
                : 'New entry'}
          </h3>
          {respondingTo ? (
            <p className="text-xs text-amber-300">Answering: {respondingTo.text}</p>
          ) : null}
          <label className="block text-sm text-stone-300">
            Title
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="block text-sm text-stone-300">
            Body
            <textarea
              rows={6}
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-stone-300">
              Visibility
              <select
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
                value={form.visibility}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    visibility: e.target.value as JournalEntryVisibility,
                  }))
                }
              >
                <option value="shared">Shared</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label className="block text-sm text-stone-300">
              Tags (comma-separated)
              <input
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="reflection, gratitude"
              />
              <span className="mt-1 flex flex-wrap gap-1">
                {TAG_SUGGESTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded border border-stone-700 px-1.5 py-0.5 text-[11px] text-stone-400 hover:border-stone-500"
                    onClick={() =>
                      setForm((f) => {
                        const existing = f.tags
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        if (existing.includes(t)) return f
                        return { ...f, tags: [...existing, t].join(', ') }
                      })
                    }
                  >
                    {t}
                  </button>
                ))}
              </span>
            </label>
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
              onClick={() => void handleSubmit()}
            >
              {editingId ? 'Save changes' : 'Save entry'}
            </button>
            <button
              type="button"
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAssignForm && partners.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-stone-700 bg-stone-900/50 p-5">
          <h3 className="text-sm font-medium text-stone-200">Assign a prompt</h3>
          <label className="block text-sm text-stone-300">
            Prompt
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={assignForm.text}
              onChange={(e) => setAssignForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="What are you grateful for this week?"
            />
          </label>
          <label className="block text-sm text-stone-300">
            Assign to
            <select
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={assignForm.assigneeId || partners[0].userId}
              onChange={(e) => setAssignForm((f) => ({ ...f, assigneeId: e.target.value }))}
            >
              {partners.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
              onClick={() => void handleAssign()}
            >
              Send assignment
            </button>
            <button
              type="button"
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
              onClick={() => {
                setShowAssignForm(false)
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {assignedByMe.length > 0 ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
          <p className="text-sm font-medium text-stone-200">Prompts you assigned</p>
          <ul className="mt-2 space-y-2 text-sm">
            {assignedByMe.map((p) => {
              const to = activeRelationship.members.find((m) => m.userId === p.assignedToUserId)
              return (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-stone-800 bg-stone-950/40 p-3"
                >
                  <div>
                    <p className="text-stone-200">{p.text}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      to {to?.displayName ?? 'Partner'} · {p.status === 'answered' ? 'answered' : 'open'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-stone-400 hover:text-stone-200"
                    onClick={() => void handleDeletePrompt(p.id)}
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5 text-stone-400">
          <input
            type="checkbox"
            checked={filterMine}
            onChange={(e) => setFilterMine(e.target.checked)}
          />
          My entries only
        </label>
        <label className="flex items-center gap-1.5 text-stone-400">
          Date:
          <input
            type="date"
            className="rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-stone-200 outline-none"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-stone-400">
          Tag:
          <select
            className="rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-stone-200 outline-none"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="">All</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <input
          className="rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-stone-200 outline-none placeholder:text-stone-600 focus:border-rose-500"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-sm text-stone-500">No journal entries yet.</p>
      ) : (
        <ul className="space-y-3">
          {filteredEntries.map((entry) => {
            const author = activeRelationship.members.find(
              (m) => m.userId === entry.authorUserId,
            )
            const locked = isLockedText(entry.body)
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-stone-800 bg-stone-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-100">{entry.title}</p>
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[11px]',
                          entry.visibility === 'private'
                            ? 'bg-stone-700 text-stone-300'
                            : 'bg-rose-950 text-rose-300',
                        ].join(' ')}
                      >
                        {entry.visibility}
                      </span>
                      {entry.assignedByUserId ? (
                        <span className="rounded-full bg-amber-950 px-2 py-0.5 text-[11px] text-amber-300">
                          assigned response
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {author?.displayName ?? 'Unknown'} ·{' '}
                      {formatLocalDateKey(entry.createdAt.slice(0, 10))}
                      {entry.tags.length > 0 ? ` · ${entry.tags.join(', ')}` : ''}
                    </p>
                  </div>
                  {entry.authorUserId === user.id ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="text-xs text-stone-400 hover:text-stone-200"
                        onClick={() => startEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-rose-400 hover:text-rose-300"
                        onClick={() => void handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                {locked ? (
                  <div className="mt-2">
                    <p className="text-sm text-stone-400">{entry.body}</p>
                    <NavLink
                      to="/settings"
                      className="mt-1 inline-block text-xs text-rose-400 hover:text-rose-300"
                    >
                      Unlock in Settings
                    </NavLink>
                  </div>
                ) : entry.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-300">{entry.body}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-stone-200">Custom prompts</h3>
          <button
            type="button"
            className="text-xs text-rose-400 hover:text-rose-300"
            onClick={() => setShowPromptForm((v) => !v)}
          >
            {showPromptForm ? 'Cancel' : 'Add prompt'}
          </button>
        </div>
        {showPromptForm ? (
          <div className="mt-3 space-y-2">
            <label className="block text-sm text-stone-300">
              Prompt text
              <input
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
                value={promptForm.text}
                onChange={(e) => setPromptForm((f) => ({ ...f, text: e.target.value }))}
              />
            </label>
            <label className="block text-sm text-stone-300">
              Category
              <input
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
                value={promptForm.category}
                onChange={(e) => setPromptForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="General"
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
              onClick={() => void handleAddPrompt()}
            >
              Save prompt
            </button>
          </div>
        ) : null}
        {customPrompts.length === 0 && !showPromptForm ? (
          <p className="mt-3 text-sm text-stone-500">No custom prompts yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {customPrompts.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-md border border-stone-800 bg-stone-950/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-stone-200">{p.text}</p>
                  <p className="mt-1 text-xs text-stone-500">{p.category}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="text-xs text-rose-400 hover:text-rose-300"
                    onClick={() => usePromptAsTitle(p.text)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="text-xs text-stone-400 hover:text-stone-200"
                    onClick={() => void handleDeletePrompt(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
