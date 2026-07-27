import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import { setHabitCompletedForDate } from '@/features/habits/habitService'
import {
  completionsOnDate,
  computeStreak,
  formatFrequency,
  isHabitDueOn,
  weeklyCompletionCount,
} from '@/features/habits/habitLogic'
import { useHabitsData } from '@/features/habits/useHabitsData'
import { toLocalDateKey } from '@/lib/date'

export function DashboardPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const myMember = activeRelationship?.members.find((m) => m.userId === user?.id)
  const { habits, categories, completions, loading, refresh } = useHabitsData(
    activeRelationship?.id,
  )

  const todayKey = toLocalDateKey()
  const todaysHabits = habits.filter(
    (h) => h.status === 'active' && isHabitDueOn(h, completions),
  )
  // Shared relationship view: everyone's due habits, current user's first.
  const sortedToday = [...todaysHabits].sort((a, b) => {
    const aMine = a.assignedToUserId === user?.id ? 0 : 1
    const bMine = b.assignedToUserId === user?.id ? 0 : 1
    if (aMine !== bMine) return aMine - bMine
    return a.title.localeCompare(b.title)
  })

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Dashboard</h2>
        <p className="mt-2 text-stone-400">Today’s habits for the active relationship.</p>
      </div>

      {activeRelationship ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5 text-sm">
          <p className="text-stone-500">Active relationship</p>
          <p className="mt-1 text-lg text-stone-100">{activeRelationship.name}</p>
          <p className="mt-2 text-stone-400">
            Your role: <span className="text-stone-200">{myMember?.role}</span>
          </p>
          <p className="mt-1 text-stone-400">
            Members:{' '}
            {activeRelationship.members.map((m) => m.displayName).join(', ') || 'Just you so far'}
          </p>
          {activeRelationship.members.length < 2 ? (
            <p className="mt-4 text-stone-300">
              Share invite code{' '}
              <code className="rounded bg-stone-800 px-1.5 py-0.5 tracking-widest text-rose-300">
                {activeRelationship.inviteCode}
              </code>{' '}
              with your partner.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-600 p-6 text-sm text-stone-500">
          No active relationship selected.
        </div>
      )}

      {activeRelationship && user ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-stone-200">Today</h3>
            <NavLink to="/habits" className="text-xs text-rose-400 hover:text-rose-300">
              Manage habits
            </NavLink>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-stone-500">Loading habits…</p>
          ) : sortedToday.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">
              Nothing due today.{' '}
              <NavLink to="/habits" className="text-rose-400 hover:text-rose-300">
                Add a habit
              </NavLink>
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sortedToday.map((habit) => {
                const category = categories.find((c) => c.id === habit.categoryId)
                const assignee = activeRelationship.members.find(
                  (m) => m.userId === habit.assignedToUserId,
                )
                const done = Boolean(completionsOnDate(completions, habit.id, todayKey))
                const streak = computeStreak(habit, completions)
                const weekProgress =
                  habit.frequency.type === 'weeklyCount'
                    ? weeklyCompletionCount(completions, habit.id, new Date())
                    : null

                return (
                  <li
                    key={habit.id}
                    className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-900/40 px-3 py-3"
                  >
                    <button
                      type="button"
                      aria-label={done ? `Uncomplete ${habit.title}` : `Complete ${habit.title}`}
                      className={[
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs',
                        done
                          ? 'border-emerald-600 bg-emerald-950 text-emerald-300'
                          : 'border-stone-600 text-transparent hover:border-stone-400',
                      ].join(' ')}
                      onClick={() => {
                        void setHabitCompletedForDate({
                          relationshipId: activeRelationship.id,
                          habitId: habit.id,
                          userId: user.id,
                          completed: !done,
                        }).then(refresh)
                      }}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {category ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        ) : null}
                        <p
                          className={[
                            'truncate text-sm',
                            done ? 'text-stone-500 line-through' : 'text-stone-100',
                          ].join(' ')}
                        >
                          {habit.title}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {formatFrequency(habit.frequency)}
                        {weekProgress !== null && habit.frequency.type === 'weeklyCount'
                          ? ` · ${weekProgress}/${habit.frequency.count}`
                          : null}
                        {' · '}
                        {assignee?.displayName ?? '—'}
                        {streak > 0 ? ` · streak ${streak}` : null}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
