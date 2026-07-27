import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  archiveHabit,
  clearHabitMissForDate,
  createCategory,
  createHabit,
  markHabitMissedForDate,
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
import {
  deleteHabitReminder,
  listHabitReminders,
  setHabitReminder,
} from '@/features/notifications/notificationService'
import { hasHabitMissPunishment } from '@/features/rewards/rewardService'
import { useRewardsData } from '@/features/rewards/useRewardsData'
import { formatLocalDateKey, toLocalDateKey } from '@/lib/date'
import type { Habit, HabitFrequency, HabitReminder } from '@/types/models'

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const

const CATEGORY_COLORS = [
  '#78716c',
  '#e11d48',
  '#0d9488',
  '#a855f7',
  '#ea580c',
  '#2563eb',
  '#ca8a04',
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
    linkedRewardId: '',
    linkedPunishmentId: '',
    pointValue: '',
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
  const { rewards, punishments, history, refresh: refreshRewards } = useRewardsData(
    relationshipId,
    { includeArchived: false },
  )

  const [reminders, setReminders] = useState<HabitReminder[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [historyHabitId, setHistoryHabitId] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm(user?.id ?? ''))
  const [categoryLabel, setCategoryLabel] = useState('')
  const [categoryColor, setCategoryColor] = useState<string>(CATEGORY_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!relationshipId || !user) {
      setReminders([])
      return
    }
    void listHabitReminders(relationshipId, user.id).then(setReminders)
  }, [relationshipId, user, habits.length])

  const todayKey = toLocalDateKey()
  const visibleHabits = useMemo(
    () => habits.filter((h) => (showArchived ? true : h.status === 'active')),
    [habits, showArchived],
  )

  const historyRows = useMemo(() => {
    const filtered =
      historyHabitId === 'all'
        ? completions
        : completions.filter((c) => c.habitId === historyHabitId)
    return [...filtered]
      .sort((a, b) => {
        if (a.completedOn === b.completedOn) {
          return b.createdAt.localeCompare(a.createdAt)
        }
        return b.completedOn.localeCompare(a.completedOn)
      })
      .slice(0, 40)
  }, [completions, historyHabitId])

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
      linkedRewardId: habit.linkedRewardId ?? '',
      linkedPunishmentId: habit.linkedPunishmentId ?? '',
      pointValue:
        habit.pointValue === null || habit.pointValue === undefined
          ? ''
          : String(habit.pointValue),
    })
    setError(null)
  }

  async function saveHabit() {
    if (!user || !relationshipId) return
    setBusy(true)
    setError(null)
    try {
      const frequency = frequencyFromForm(form)
      const pointValue =
        form.pointValue.trim() === '' ? null : Math.max(0, Math.floor(Number(form.pointValue) || 0))
      if (editingId) {
        await updateHabit(relationshipId, editingId, {
          title: form.title,
          description: form.description,
          categoryId: form.categoryId || null,
          frequency,
          assignedToUserId: form.assignedToUserId,
          linkedRewardId: form.linkedRewardId || null,
          linkedPunishmentId: form.linkedPunishmentId || null,
          pointValue,
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
          linkedRewardId: form.linkedRewardId || null,
          linkedPunishmentId: form.linkedPunishmentId || null,
          pointValue,
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

  async function saveCategory() {
    if (!relationshipId) return
    setCategoryError(null)
    try {
      const created = await createCategory({
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

  async function toggleToday(habit: Habit) {
    if (!user || !relationshipId) return
    const done = Boolean(completionsOnDate(completions, habit.id, todayKey))
    await setHabitCompletedForDate({
      relationshipId,
      habitId: habit.id,
      userId: user.id,
      completed: !done,
    })
    await Promise.all([refresh(), refreshRewards()])
  }

  async function toggleMiss(habit: Habit) {
    if (!user || !relationshipId) return
    const missed = hasHabitMissPunishment(history, habit.id, todayKey)
    if (missed) {
      await clearHabitMissForDate({
        relationshipId,
        habitId: habit.id,
        missedOn: todayKey,
      })
    } else {
      await markHabitMissedForDate({
        relationshipId,
        habitId: habit.id,
        userId: user.id,
        missedOn: todayKey,
      })
    }
    await refreshRewards()
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
        <h3 className="text-sm font-medium text-stone-200">Categories</h3>
        <p className="mt-1 text-sm text-stone-400">
          Defaults are seeded per relationship. Add your own labels and colors.
        </p>
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

        <label className="mt-3 block text-sm text-stone-300">
          Linked reward
          <select
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.linkedRewardId}
            onChange={(e) => setForm((f) => ({ ...f, linkedRewardId: e.target.value }))}
          >
            <option value="">None</option>
            {rewards.map((reward) => (
              <option key={reward.id} value={reward.id}>
                {reward.title}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm text-stone-300">
          Linked punishment
          <select
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.linkedPunishmentId}
            onChange={(e) => setForm((f) => ({ ...f, linkedPunishmentId: e.target.value }))}
          >
            <option value="">None</option>
            {punishments.map((punishment) => (
              <option key={punishment.id} value={punishment.id}>
                {punishment.title}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm text-stone-300">
          Points on completion
          <input
            type="number"
            min={0}
            placeholder="10 (default)"
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={form.pointValue}
            onChange={(e) => setForm((f) => ({ ...f, pointValue: e.target.value }))}
          />
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
              const missedToday = hasHabitMissPunishment(history, habit.id, todayKey)
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
                        {missedToday ? (
                          <span className="text-xs text-rose-400">Missed</span>
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
                        {habit.pointValue ? ` · ${habit.pointValue} pts` : ''}
                        {habit.linkedRewardId ? ' · auto reward linked' : ''}
                        {habit.linkedPunishmentId ? ' · punishment linked' : ''}
                      </p>
                    </div>
                    {habit.status === 'active' && dueToday ? (
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          className={[
                            'rounded-md border px-2.5 py-1 text-xs',
                            doneToday
                              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                              : 'border-stone-600 text-stone-300 hover:border-stone-400',
                          ].join(' ')}
                          onClick={() => void toggleToday(habit)}
                        >
                          {doneToday ? 'Done today' : 'Mark done'}
                        </button>
                        {habit.linkedPunishmentId && !doneToday ? (
                          <button
                            type="button"
                            className={[
                              'rounded-md border px-2.5 py-1 text-xs',
                              missedToday
                                ? 'border-rose-700 bg-rose-950/40 text-rose-300'
                                : 'border-stone-600 text-stone-300 hover:border-rose-500',
                            ].join(' ')}
                            onClick={() => void toggleMiss(habit)}
                          >
                            {missedToday ? 'Clear miss' : 'Mark missed'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {habit.status === 'active' && user && habit.assignedToUserId === user.id ? (
                      <label className="flex items-center gap-1.5 text-stone-400">
                        Reminder
                        <input
                          type="time"
                          className="rounded border border-stone-700 bg-stone-900 px-1.5 py-0.5 text-stone-200"
                          value={
                            reminders.find((r) => r.habitId === habit.id)?.timeLocal ?? ''
                          }
                          onChange={(e) => {
                            const timeLocal = e.target.value
                            if (!timeLocal || !relationshipId) return
                            void setHabitReminder({
                              relationshipId,
                              habitId: habit.id,
                              userId: user.id,
                              timeLocal,
                              enabled: true,
                            }).then((r) =>
                              setReminders((prev) => {
                                const others = prev.filter((x) => x.habitId !== habit.id)
                                return [...others, r]
                              }),
                            )
                          }}
                        />
                        {reminders.find((r) => r.habitId === habit.id) ? (
                          <button
                            type="button"
                            className="text-stone-500 hover:text-rose-300"
                            onClick={() => {
                              const existing = reminders.find((r) => r.habitId === habit.id)
                              if (!existing || !relationshipId) return
                              void deleteHabitReminder(relationshipId, existing.id).then(() =>
                                setReminders((prev) =>
                                  prev.filter((x) => x.id !== existing.id),
                                ),
                              )
                            }}
                          >
                            Clear
                          </button>
                        ) : null}
                      </label>
                    ) : null}
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
                    <button
                      type="button"
                      className="text-stone-400 hover:text-stone-200"
                      onClick={() => setHistoryHabitId(habit.id)}
                    >
                      View history
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-stone-200">Completion history</h3>
          <label className="text-xs text-stone-400">
            Habit
            <select
              className="ml-2 rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-stone-200 outline-none focus:border-rose-500"
              value={historyHabitId}
              onChange={(e) => setHistoryHabitId(e.target.value)}
            >
              <option value="all">All habits</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {historyRows.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No completions logged yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-800 text-sm">
            {historyRows.map((row) => {
              const habit = habits.find((h) => h.id === row.habitId)
              const member = activeRelationship.members.find((m) => m.userId === row.userId)
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-stone-200">{habit?.title ?? 'Deleted habit'}</p>
                    <p className="text-xs text-stone-500">
                      {member?.displayName ?? 'Unknown'} · {formatLocalDateKey(row.completedOn)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-emerald-400">Done</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
