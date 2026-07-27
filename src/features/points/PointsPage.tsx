import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  DECRYPT_FAILED_TEXT,
  grantPoints,
  LOCKED_TEXT,
  purchaseRewardWithPoints,
} from '@/features/points/pointService'
import { usePointsData } from '@/features/points/usePointsData'
import { useRewardsData } from '@/features/rewards/useRewardsData'
import { formatLocalDateKey } from '@/lib/date'

function isLockedText(value: string): boolean {
  return value === LOCKED_TEXT || value === DECRYPT_FAILED_TEXT
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'habit_completion':
      return 'Habit completion'
    case 'manual_grant':
      return 'Manual grant'
    case 'manual_adjust':
      return 'Manual adjust'
    case 'reward_purchase':
      return 'Reward purchase'
    default:
      return source
  }
}

export function PointsPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const memberUserIds = useMemo(
    () => activeRelationship?.members.map((m) => m.userId) ?? [],
    [activeRelationship],
  )
  const { balance, memberBalances, ledger, loading, refresh } = usePointsData(
    relationshipId,
    user?.id,
    memberUserIds,
  )
  const { rewards, categories } = useRewardsData(relationshipId, { includeArchived: false })

  const [grantUserId, setGrantUserId] = useState('')
  const [grantAmount, setGrantAmount] = useState('10')
  const [grantNote, setGrantNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [storeNote, setStoreNote] = useState('')
  const [ledgerFilterMine, setLedgerFilterMine] = useState(false)

  const storeRewards = useMemo(
    () => rewards.filter((r) => r.status === 'active' && r.pointCost > 0),
    [rewards],
  )

  const filteredLedger = ledgerFilterMine && user
    ? ledger.filter((e) => e.userId === user.id)
    : ledger

  const runningBalances = useMemo(() => {
    const totals = new Map<string, number>()
    const result: number[] = []
    const reversed = [...filteredLedger].reverse()
    for (const entry of reversed) {
      const prev = totals.get(entry.userId) ?? 0
      totals.set(entry.userId, prev + entry.amount)
    }
    const cursor = new Map(totals)
    for (const entry of filteredLedger) {
      const current = cursor.get(entry.userId) ?? 0
      result.push(current)
      cursor.set(entry.userId, current - entry.amount)
    }
    return result
  }, [filteredLedger])

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Points</h2>
        <p className="mt-2 text-stone-400">Select an active relationship first.</p>
      </section>
    )
  }

  const targetUserId = grantUserId || user.id

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Points</h2>
        <p className="mt-2 text-stone-400">
          Earn points from habit completions, grant manually, and spend in the reward store.
        </p>
        <NavLink to="/rewards" className="mt-2 inline-block text-sm text-rose-400 hover:text-rose-300">
          Manage reward catalog
        </NavLink>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <p className="text-xs uppercase tracking-wide text-stone-500">Balances</p>
        {loading ? (
          <p className="mt-2 text-sm text-stone-500">Loading…</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activeRelationship.members.map((m) => {
              const mb = memberBalances.find((b) => b.userId === m.userId)
              const isMe = m.userId === user.id
              return (
                <div
                  key={m.userId}
                  className={[
                    'rounded-md border p-3',
                    isMe ? 'border-rose-800 bg-rose-950/20' : 'border-stone-700 bg-stone-950/30',
                  ].join(' ')}
                >
                  <p className="text-xs text-stone-400">
                    {m.displayName}
                    {isMe ? ' (you)' : ''}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-stone-50">
                    {mb?.balance ?? 0}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Manual grant / adjust</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm text-stone-300">
            Member
            <select
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={targetUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
            >
              {activeRelationship.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-stone-300">
            Amount (+/-)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm text-stone-300">
            Note
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-4 rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
          onClick={() => {
            void grantPoints({
              relationshipId: activeRelationship.id,
              userId: targetUserId,
              amount: Number(grantAmount),
              createdByUserId: user.id,
              note: grantNote,
            })
              .then(() => {
                setGrantNote('')
                setError(null)
                return refresh()
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Could not update points.'),
              )
          }}
        >
          Apply to ledger
        </button>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Reward store</h3>
        <p className="mt-1 text-sm text-stone-400">
          Spend your points on catalog rewards that have a point cost.
        </p>
        <label className="mt-3 block text-sm text-stone-300">
          Purchase note
          <input
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
            value={storeNote}
            onChange={(e) => setStoreNote(e.target.value)}
          />
        </label>
        {storeRewards.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No priced rewards yet.{' '}
            <NavLink to="/rewards" className="text-rose-400 hover:text-rose-300">
              Add a point cost
            </NavLink>
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {storeRewards.map((reward) => {
              const category = reward.categoryId
                ? categories.find((c) => c.id === reward.categoryId)
                : undefined
              const affordable = balance >= reward.pointCost
              return (
                <li
                  key={reward.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-stone-800 bg-stone-950/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-100">{reward.title}</p>
                      {category ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-400">{reward.description}</p>
                    {isLockedText(reward.description) ? (
                      <NavLink
                        to="/settings"
                        className="mt-1 inline-block text-xs text-rose-400 hover:text-rose-300"
                      >
                        Unlock in Settings
                      </NavLink>
                    ) : null}
                    <p className="mt-1 text-xs text-stone-500">{reward.pointCost} points</p>
                  </div>
                  <button
                    type="button"
                    disabled={!affordable}
                    className="shrink-0 rounded-md border border-rose-700 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-40"
                    onClick={() => {
                      void purchaseRewardWithPoints({
                        relationshipId: activeRelationship.id,
                        rewardId: reward.id,
                        buyerUserId: user.id,
                        note: storeNote,
                      })
                        .then(() => {
                          setStoreNote('')
                          setError(null)
                          return refresh()
                        })
                        .catch((err: unknown) =>
                          setError(err instanceof Error ? err.message : 'Purchase failed.'),
                        )
                    }}
                  >
                    {affordable ? 'Buy' : 'Need more'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-stone-200">Ledger</h3>
          <label className="text-xs text-stone-400">
            <input
              type="checkbox"
              className="mr-1.5"
              checked={ledgerFilterMine}
              onChange={(e) => setLedgerFilterMine(e.target.checked)}
            />
            My entries only
          </label>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Loading…</p>
        ) : filteredLedger.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No ledger entries yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {filteredLedger.slice(0, 50).map((entry, idx) => {
              const member = activeRelationship.members.find((m) => m.userId === entry.userId)
              const by = activeRelationship.members.find((m) => m.userId === entry.createdByUserId)
              const running = runningBalances[idx] ?? 0
              return (
                <li
                  key={entry.id}
                  className="rounded-md border border-stone-800 bg-stone-950/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-stone-200">
                      {member?.displayName ?? 'Unknown'} · {sourceLabel(entry.source)}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p
                        className={
                          entry.amount >= 0
                            ? 'font-medium text-emerald-300'
                            : 'font-medium text-rose-300'
                        }
                      >
                        {entry.amount >= 0 ? '+' : ''}
                        {entry.amount}
                      </p>
                      <p className="text-xs text-stone-500">= {running}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    by {by?.displayName ?? 'Unknown'} ·{' '}
                    {formatLocalDateKey(entry.createdAt.slice(0, 10))}
                  </p>
                  {entry.note ? (
                    isLockedText(entry.note) ? (
                      <div className="mt-1">
                        <p className="text-stone-400">{entry.note}</p>
                        <NavLink
                          to="/settings"
                          className="mt-1 inline-block text-xs text-rose-400 hover:text-rose-300"
                        >
                          Unlock note in Settings
                        </NavLink>
                      </div>
                    ) : (
                      <p className="mt-1 text-stone-400">{entry.note}</p>
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </div>
    </section>
  )
}
