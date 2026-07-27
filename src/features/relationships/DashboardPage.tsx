import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  markHabitMissedForDate,
  setHabitCompletedForDate,
} from '@/features/habits/habitService'
import {
  completionsOnDate,
  computeStreak,
  formatFrequency,
  isHabitDueOn,
  weeklyCompletionCount,
} from '@/features/habits/habitLogic'
import { useHabitsData } from '@/features/habits/useHabitsData'
import { ruleNeedsAcknowledgmentFrom } from '@/features/rules/ruleLogic'
import { useRulesData } from '@/features/rules/useRulesData'
import { hasHabitMissPunishment } from '@/features/rewards/rewardService'
import { useRewardsData } from '@/features/rewards/useRewardsData'
import { usePointsData } from '@/features/points/usePointsData'
import {
  computeJournalStreak,
} from '@/features/journal/journalService'
import { useJournalData } from '@/features/journal/useJournalData'
import {
  countUnreadMessages,
  previewChatBody,
} from '@/features/chat/chatService'
import { useChatData } from '@/features/chat/useChatData'
import { formatPercent } from '@/features/stats/statsLogic'
import { useStatsData } from '@/features/stats/useStatsData'
import { formatLocalDateKey, toLocalDateKey } from '@/lib/date'

export function DashboardPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const myMember = activeRelationship?.members.find((m) => m.userId === user?.id)
  const { habits, categories, completions, loading, refresh } = useHabitsData(
    activeRelationship?.id,
  )
  const {
    history,
    refresh: refreshRewards,
    loading: rewardsLoading,
  } = useRewardsData(activeRelationship?.id, { includeArchived: false })
  const { balance, refresh: refreshPoints } = usePointsData(activeRelationship?.id, user?.id)
  const {
    entries: journalEntries,
    prompts: journalPrompts,
    loading: journalLoading,
  } = useJournalData(activeRelationship?.id, user?.id)
  const { messages: chatMessages, loading: chatLoading } = useChatData(
    activeRelationship?.id,
    user?.id,
    { markRead: false },
  )
  const {
    habitStats: dashHabitStats,
    pointsStats: dashPointsStats,
    journalStreak: dashJournalStreak,
    loading: statsLoading,
  } = useStatsData(activeRelationship?.id, user?.id, activeRelationship?.members ?? [])
  const { rules, acknowledgments, loading: rulesLoading } = useRulesData(activeRelationship?.id)
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(true)

  const todayKey = toLocalDateKey()
  const journalStreak = user ? computeJournalStreak(journalEntries, user.id) : 0
  const recentSharedJournal = journalEntries
    .filter((e) => e.visibility === 'shared')
    .slice(0, 3)
  const pendingAssignedPrompts = user
    ? journalPrompts.filter(
        (p) => p.assignedToUserId === user.id && p.status === 'open',
      )
    : []
  const chatUnread = user ? countUnreadMessages(chatMessages, user.id) : 0
  const lastChatMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null
  const todaysHabits = habits.filter((h) => {
    if (h.status !== 'active' || !isHabitDueOn(h, completions)) return false
    if (assignedToMeOnly && user) return h.assignedToUserId === user.id
    return true
  })
  const sortedToday = [...todaysHabits].sort((a, b) => a.title.localeCompare(b.title))
  const pendingRuleAcks =
    user && myMember
      ? rules.filter((rule) =>
          ruleNeedsAcknowledgmentFrom(rule, user.id, myMember.role, acknowledgments),
        )
      : []
  const recentCatalogEntries = user
    ? history
        .filter((e) => (!assignedToMeOnly ? true : e.targetUserId === user.id))
        .slice(0, 3)
    : []

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Dashboard</h2>
        <p className="mt-2 text-stone-400">Today’s habits for the active relationship.</p>
      </div>

      {activeRelationship && user ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Your points</p>
              <p className="mt-1 text-2xl font-semibold text-stone-50">{balance}</p>
            </div>
            <NavLink to="/points" className="text-xs text-rose-400 hover:text-rose-300">
              Open ledger
            </NavLink>
          </div>
        </div>
      ) : null}

      {activeRelationship && user ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-stone-500">Stats snapshot</p>
            <NavLink to="/stats" className="text-xs text-rose-400 hover:text-rose-300">
              Open stats
            </NavLink>
          </div>
          {statsLoading ? (
            <p className="mt-2 text-sm text-stone-500">Loading…</p>
          ) : (
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[11px] text-stone-500">Habit rate</dt>
                <dd className="mt-1 text-lg font-semibold text-stone-50">
                  {formatPercent(dashHabitStats.overallRate)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-stone-500">Points net</dt>
                <dd className="mt-1 text-lg font-semibold text-stone-50">{dashPointsStats.net}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-stone-500">Journal streak</dt>
                <dd className="mt-1 text-lg font-semibold text-stone-50">{dashJournalStreak}</dd>
              </div>
            </dl>
          )}
        </div>
      ) : null}

      {activeRelationship && user ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Journal streak</p>
              <p className="mt-1 text-2xl font-semibold text-stone-50">
                {journalLoading ? '…' : journalStreak}
              </p>
            </div>
            <NavLink to="/journal" className="text-xs text-rose-400 hover:text-rose-300">
              Open journal
            </NavLink>
          </div>
          {pendingAssignedPrompts.length > 0 ? (
            <p className="mt-2 text-xs text-amber-300">
              {pendingAssignedPrompts.length} assigned prompt
              {pendingAssignedPrompts.length === 1 ? '' : 's'} waiting
            </p>
          ) : null}
          {recentSharedJournal.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-stone-800 pt-3 text-sm">
              {recentSharedJournal.map((entry) => {
                const author = activeRelationship.members.find(
                  (m) => m.userId === entry.authorUserId,
                )
                return (
                  <li key={entry.id} className="text-stone-300">
                    <span className="text-stone-100">{entry.title}</span>
                    <span className="text-xs text-stone-500">
                      {' '}
                      · {author?.displayName ?? 'Unknown'} ·{' '}
                      {formatLocalDateKey(entry.createdAt.slice(0, 10))}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-stone-500">No shared entries yet.</p>
          )}
        </div>
      ) : null}

      {activeRelationship && user ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Chat</p>
              <p className="mt-1 text-2xl font-semibold text-stone-50">
                {chatLoading ? '…' : chatUnread}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">unread</p>
            </div>
            <NavLink to="/chat" className="text-xs text-rose-400 hover:text-rose-300">
              Open chat
            </NavLink>
          </div>
          {lastChatMessage ? (
            <p className="mt-3 border-t border-stone-800 pt-3 text-sm text-stone-300">
              <span className="text-stone-500">Latest: </span>
              {previewChatBody(lastChatMessage)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-stone-500">No messages yet.</p>
          )}
        </div>
      ) : null}

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
          <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-amber-200">Rule acknowledgments</p>
              <NavLink to="/rules" className="text-xs text-amber-300 hover:text-amber-200">
                Open rules
              </NavLink>
            </div>
            {rulesLoading ? (
              <p className="mt-1 text-xs text-stone-400">Checking…</p>
            ) : pendingRuleAcks.length > 0 ? (
              <p className="mt-1 text-xs text-amber-300">
                {pendingRuleAcks.length} pending:{' '}
                {pendingRuleAcks
                  .slice(0, 2)
                  .map((r) => r.title)
                  .join(', ')}
                {pendingRuleAcks.length > 2 ? '…' : ''}
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-300">
                All required acknowledgments are up to date.
              </p>
            )}
          </div>

          {rewardsLoading ? null : recentCatalogEntries.length > 0 ? (
            <div className="mb-4 rounded-lg border border-stone-700 bg-stone-900/50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-stone-500">
                Recent rewards & punishments
              </p>
              <ul className="mt-2 space-y-1">
                {recentCatalogEntries.map((entry) => {
                  const target = activeRelationship.members.find(
                    (m) => m.userId === entry.targetUserId,
                  )
                  const by = activeRelationship.members.find(
                    (m) => m.userId === entry.appliedByUserId,
                  )
                  return (
                    <li key={entry.id} className="rounded border border-stone-800 bg-stone-950/30 p-2">
                      <p className="text-stone-200">
                        {entry.itemType === 'reward' ? 'Reward' : 'Punishment'}: {entry.itemTitle}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {entry.source} · {target?.displayName ?? 'Unknown target'} · by{' '}
                        {by?.displayName ?? 'Unknown'} ·{' '}
                        {formatLocalDateKey(entry.appliedAt.slice(0, 10))}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-stone-200">Today</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs text-stone-400">
                <input
                  type="checkbox"
                  className="mr-1.5"
                  checked={assignedToMeOnly}
                  onChange={(e) => setAssignedToMeOnly(e.target.checked)}
                />
                Assigned to me
              </label>
              <NavLink to="/habits" className="text-xs text-rose-400 hover:text-rose-300">
                Manage habits
              </NavLink>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-stone-500">Loading habits…</p>
          ) : sortedToday.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">
              {assignedToMeOnly
                ? 'Nothing assigned to you today.'
                : 'Nothing due today.'}{' '}
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
                const missed = hasHabitMissPunishment(history, habit.id, todayKey)
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
                        }).then(() =>
                          Promise.all([refresh(), refreshRewards(), refreshPoints()]),
                        )
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
                            done
                              ? 'text-stone-500 line-through'
                              : missed
                                ? 'text-rose-300'
                                : 'text-stone-100',
                          ].join(' ')}
                        >
                          {habit.title}
                        </p>
                        {missed && !done ? (
                          <span className="text-[10px] uppercase tracking-wide text-rose-400">
                            Missed
                          </span>
                        ) : null}
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
                    {habit.linkedPunishmentId && !done ? (
                      <button
                        type="button"
                        className={[
                          'shrink-0 rounded-md border px-2 py-1 text-[11px]',
                          missed
                            ? 'border-rose-700 text-rose-300'
                            : 'border-stone-600 text-stone-400 hover:border-rose-500 hover:text-rose-300',
                        ].join(' ')}
                        onClick={() => {
                          if (missed) return
                          void markHabitMissedForDate({
                            relationshipId: activeRelationship.id,
                            habitId: habit.id,
                            userId: user.id,
                            missedOn: todayKey,
                          }).then(refreshRewards)
                        }}
                      >
                        {missed ? 'Missed' : 'Miss'}
                      </button>
                    ) : null}
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
