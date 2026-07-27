import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  archiveHabit,
  createHabit,
  setHabitCompletedForDate,
  updateHabit,
} from '@/features/habits/habitService'
import {
  completionsOnDate,
  computeStreak,
  formatFrequency,
  isHabitDueOn,
  weeklyCompletionCount,
} from '@/features/habits/habitLogic'
import { useHabitsData } from '@/features/habits/useHabitsData'
import { toLocalDateKey } from '@/lib/date'
import type { Habit, HabitFrequency } from '@/types/models'

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const

type FrequencyMode = 'daily' | 'weekdays' | 'weeklyCount'

function emptyForm(assignedToUserId: string) {
  return {
    title: '',
    description: '',
    categoryId: '' as string,
    frequencyMode: 'daily' as FrequencyMode,
    weekdays: [1, 2, 3, 4, 5] as number[],
    weeklyCount: 3,
    assignedToUserId,
  }
}

function frequencyFromForm(form: ReturnType<typeof emptyForm>): HabitFrequency {
  if (form.frequencyMode === 'daily') return { type: 'daily' }
  if (form.frequencyMode === 'weeklyCount') {
    return { type: 'weeklyCount', count: form.weeklyCount }
  }
  return { type: 'weekdays', days: form.weekdays }
}

export function HabitsPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const { habits, categories, completions, loading, refresh } = useHabitsData(relationshipId, {
    includeArchived: true,
  })

  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm(user?.id ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const todayKey = toLocalDateKey()
  const visibleHabits = useMemo(
    () => habits.filter((h) => (showArchived ? true : h.status === 'active')),
    [habits, showArchived],
  )

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm(user?.id ?? ''))
    setError(null)
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id)
    setForm({
      title: habit.title,
      description: habit.description,
      categoryId: habit.categoryId ?? '',
      frequencyMode: habit.frequency.type,
      weekdays: habit.frequency.type === 'weekdays' ? [...habit.frequency.days] : [1, 2, 3, 4, 5],
      weeklyCount: habit.frequency.type === 'weeklyCount' ? habit.frequency.count : 3,
      assignedToUserId: habit.assignedToUserId,
    })
    setError(null)
  }

  async function saveHabit() {
    if (!user || !relationshipId) return
    setBusy(true)
    setError(null)
    try {
      const frequency = frequencyFromForm(form)
      if (editingId) {
        await updateHabit(relationshipId, editingId, {
          title: form.title,
          description: form.description,
          categoryId: form.categoryId || null,
          frequency,
          assignedToUserId: form.assignedToUserId,
        })
      } else {
        await createHabit({
          relationshipId,
          title: form.title,
          description: form.description,
          categoryId: form.categoryId || null,
          frequency,
          assignedToUserId: form.assignedToUserId,
          createdByUserId: user.id,
        })
      }
      startCreate()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save habit.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleToday(habit: Habit) {
    if (!user || !relationshipId) return
    const done = Boolean(completionsOnDate(completions, habit.id, todayKey))
    await setHabitCompletedForDate({
      relationshipId,
      habitId: habit.id,
      userId: user.id,
      completed: !done,
    })
    await refresh()
  }

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Habits & Tasks</h2>
        <p className="mt-2 text-stone-400">Select an active relationship to manage habits.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Habits & Tasks</h2>
        <p className="mt-2 text-stone-400">
          Recurring tasks for {activeRelationship.name}. Streaks update from completion history.
        </p>
        <NavLink to="/" className="mt-2 inline-block text-sm text-rose-400 hover:text-rose-300">
          View today’s list on the dashboard
        </NavLink>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">
          {editingId ? 'Edit habit' : 'New habit'}
        </h3>

        <label className="mt-4 block text-sm text-stone-300">
          Title
          <input
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={80}
          />
        </label>

        <label className="mt-3 block text-sm text-stone-300">
          Description
          <textarea
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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

        <label className="mt-3 block text-sm text-stone-300">
          Assigned to
          <select
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.assignedToUserId}
            onChange={(e) => setForm((f) => ({ ...f, assignedToUserId: e.target.value }))}
          >
            {activeRelationship.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName} ({m.role})
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-3">
          <legend className="text-sm text-stone-300">Frequency</legend>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-300">
            {(
              [
                ['daily', 'Daily'],
                ['weekdays', 'Specific days'],
                ['weeklyCount', 'Times per week'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="frequency"
                  checked={form.frequencyMode === value}
                  onChange={() => setForm((f) => ({ ...f, frequencyMode: value }))}
                />
                {label}
              </label>
            ))}
          </div>

          {form.frequencyMode === 'weekdays' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const on = form.weekdays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={[
                      'rounded-md border px-2 py-1 text-xs',
                      on
                        ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                        : 'border-stone-600 text-stone-400',
                    ].join(' ')}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        weekdays: on
                          ? f.weekdays.filter((d) => d !== day.value)
                          : [...f.weekdays, day.value],
                      }))
                    }
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          {form.frequencyMode === 'weeklyCount' ? (
            <label className="mt-3 block text-sm text-stone-300">
              Times per week
              <input
                type="number"
                min={1}
                max={7}
                className="mt-1 w-24 rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
                value={form.weeklyCount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weeklyCount: Number(e.target.value) || 1 }))
                }
              />
            </label>
          ) : null}
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !form.title.trim()}
            className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-50"
            onClick={() => void saveHabit()}
          >
            {editingId ? 'Save changes' : 'Create habit'}
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-stone-200">All habits</h3>
          <label className="text-xs text-stone-400">
            <input
              type="checkbox"
              className="mr-1.5"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">Loading…</p>
        ) : visibleHabits.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No habits yet. Create one above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visibleHabits.map((habit) => {
              const category = categories.find((c) => c.id === habit.categoryId)
              const assignee = activeRelationship.members.find(
                (m) => m.userId === habit.assignedToUserId,
              )
              const doneToday = Boolean(completionsOnDate(completions, habit.id, todayKey))
              const dueToday = isHabitDueOn(habit, completions)
              const streak = computeStreak(habit, completions)
              const weekProgress =
                habit.frequency.type === 'weeklyCount'
                  ? weeklyCompletionCount(completions, habit.id, new Date())
                  : null

              return (
                <li
                  key={habit.id}
                  className="rounded-lg border border-stone-700 bg-stone-900/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {category ? (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: category.color }}
                            title={category.label}
                          />
                        ) : null}
                        <p className="font-medium text-stone-100">{habit.title}</p>
                        {habit.status === 'archived' ? (
                          <span className="text-xs text-stone-500">Archived</span>
                        ) : null}
                      </div>
                      {habit.description ? (
                        <p className="mt-1 text-sm text-stone-400">{habit.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-stone-500">
                        {formatFrequency(habit.frequency)}
                        {weekProgress !== null && habit.frequency.type === 'weeklyCount'
                          ? ` · ${weekProgress}/${habit.frequency.count} this week`
                          : null}
                        {' · '}
                        {assignee?.displayName ?? 'Unassigned'}
                        {' · '}
                        streak {streak}
                      </p>
                    </div>
                    {habit.status === 'active' && dueToday ? (
                      <button
                        type="button"
                        className={[
                          'shrink-0 rounded-md border px-2.5 py-1 text-xs',
                          doneToday
                            ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                            : 'border-stone-600 text-stone-300 hover:border-stone-400',
                        ].join(' ')}
                        onClick={() => void toggleToday(habit)}
                      >
                        {doneToday ? 'Done today' : 'Mark done'}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {habit.status === 'active' ? (
                      <>
                        <button
                          type="button"
                          className="text-stone-400 hover:text-stone-200"
                          onClick={() => startEdit(habit)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-stone-400 hover:text-rose-300"
                          onClick={() => {
                            void archiveHabit(habit.relationshipId, habit.id).then(refresh)
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
                          void updateHabit(habit.relationshipId, habit.id, {
                            status: 'active',
                          }).then(refresh)
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
