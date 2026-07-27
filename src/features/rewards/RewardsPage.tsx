import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  applyPunishmentManually,
  applyRewardManually,
  createPunishment,
  createReward,
  createRewardPunishmentCategory,
  DECRYPT_FAILED_TEXT,
  LOCKED_TEXT,
  updatePunishment,
  updateReward,
} from '@/features/rewards/rewardService'
import { useRewardsData } from '@/features/rewards/useRewardsData'
import { formatLocalDateKey } from '@/lib/date'

const CATEGORY_COLORS = ['#e11d48', '#0d9488', '#2563eb', '#a855f7', '#ea580c', '#78716c'] as const

function isLockedText(value: string): boolean {
  return value === LOCKED_TEXT || value === DECRYPT_FAILED_TEXT
}

export function RewardsPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const { categories, rewards, punishments, history, loading, refresh } = useRewardsData(
    relationshipId,
    { includeArchived: true },
  )

  const [rewardEditingId, setRewardEditingId] = useState<string | null>(null)
  const [punishmentEditingId, setPunishmentEditingId] = useState<string | null>(null)
  const [rewardForm, setRewardForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    pointCost: 0,
  })
  const [punishmentForm, setPunishmentForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    severity: 3,
  })
  const [categoryLabel, setCategoryLabel] = useState('')
  const [categoryColor, setCategoryColor] = useState<string>(CATEGORY_COLORS[0])
  const [applyTargetUserId, setApplyTargetUserId] = useState<string>('')
  const [applyNote, setApplyNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeRewards = useMemo(() => rewards.filter((r) => r.status === 'active'), [rewards])
  const activePunishments = useMemo(
    () => punishments.filter((p) => p.status === 'active'),
    [punishments],
  )

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
          Rewards & Punishments
        </h2>
        <p className="mt-2 text-stone-400">Select an active relationship first.</p>
      </section>
    )
  }

  const targetUserId = applyTargetUserId || activeRelationship.members[0]?.userId || user.id

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
          Rewards & Punishments
        </h2>
        <p className="mt-2 text-stone-400">
          Build libraries, manually apply outcomes, and log automatic habit rewards.
        </p>
        <div className="mt-2 flex gap-4 text-sm">
          <NavLink to="/habits" className="text-rose-400 hover:text-rose-300">
            Link rewards on habits
          </NavLink>
          <NavLink to="/rules" className="text-rose-400 hover:text-rose-300">
            Apply default rule consequences
          </NavLink>
        </div>
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
            />
          </label>
          <div className="flex gap-1.5 pb-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                className={[
                  'h-7 w-7 rounded-md border',
                  color === categoryColor ? 'border-stone-100' : 'border-stone-700',
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
            onClick={() => {
              void createRewardPunishmentCategory({
                relationshipId: activeRelationship.id,
                label: categoryLabel,
                color: categoryColor,
              }).then(() => {
                setCategoryLabel('')
                void refresh()
              })
            }}
          >
            Add category
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
          <h3 className="text-sm font-medium text-stone-200">
            {rewardEditingId ? 'Edit reward' : 'New reward'}
          </h3>
          <label className="mt-3 block text-sm text-stone-300">
            Title
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={rewardForm.title}
              onChange={(e) => setRewardForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-sm text-stone-300">
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              rows={3}
              value={rewardForm.description}
              onChange={(e) => setRewardForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-sm text-stone-300">
            Category
            <select
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={rewardForm.categoryId}
              onChange={(e) => setRewardForm((f) => ({ ...f, categoryId: e.target.value }))}
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
            Point cost
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={rewardForm.pointCost}
              onChange={(e) =>
                setRewardForm((f) => ({ ...f, pointCost: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <button
            type="button"
            className="mt-4 rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
            onClick={() => {
              const op = rewardEditingId
                ? updateReward(activeRelationship.id, rewardEditingId, rewardForm)
                : createReward({
                    relationshipId: activeRelationship.id,
                    createdByUserId: user.id,
                    ...rewardForm,
                  })
              void op
                .then(() => {
                  setRewardEditingId(null)
                  setRewardForm({ title: '', description: '', categoryId: '', pointCost: 0 })
                  setError(null)
                  return refresh()
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Could not save reward.'),
                )
            }}
          >
            {rewardEditingId ? 'Save reward' : 'Create reward'}
          </button>
        </div>

        <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
          <h3 className="text-sm font-medium text-stone-200">
            {punishmentEditingId ? 'Edit punishment' : 'New punishment'}
          </h3>
          <label className="mt-3 block text-sm text-stone-300">
            Title
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={punishmentForm.title}
              onChange={(e) => setPunishmentForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-sm text-stone-300">
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              rows={3}
              value={punishmentForm.description}
              onChange={(e) =>
                setPunishmentForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label className="mt-3 block text-sm text-stone-300">
            Category
            <select
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={punishmentForm.categoryId}
              onChange={(e) =>
                setPunishmentForm((f) => ({ ...f, categoryId: e.target.value }))
              }
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
            Severity
            <input
              type="number"
              min={1}
              max={5}
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={punishmentForm.severity}
              onChange={(e) =>
                setPunishmentForm((f) => ({ ...f, severity: Number(e.target.value) || 1 }))
              }
            />
          </label>
          <button
            type="button"
            className="mt-4 rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500"
            onClick={() => {
              const op = punishmentEditingId
                ? updatePunishment(activeRelationship.id, punishmentEditingId, punishmentForm)
                : createPunishment({
                    relationshipId: activeRelationship.id,
                    createdByUserId: user.id,
                    ...punishmentForm,
                  })
              void op
                .then(() => {
                  setPunishmentEditingId(null)
                  setPunishmentForm({ title: '', description: '', categoryId: '', severity: 3 })
                  setError(null)
                  return refresh()
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Could not save punishment.'),
                )
            }}
          >
            {punishmentEditingId ? 'Save punishment' : 'Create punishment'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Manual apply</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm text-stone-300">
            Target
            <select
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={targetUserId}
              onChange={(e) => setApplyTargetUserId(e.target.value)}
            >
              {activeRelationship.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-stone-300 md:col-span-2">
            Note
            <input
              className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-rose-500"
              value={applyNote}
              onChange={(e) => setApplyNote(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Rewards</p>
            <ul className="mt-2 space-y-2">
              {activeRewards.map((reward) => (
                <CatalogCard
                  key={reward.id}
                  title={reward.title}
                  description={reward.description}
                  footer={`cost ${reward.pointCost}`}
                  locked={isLockedText(reward.description)}
                  onEdit={() => {
                    setRewardEditingId(reward.id)
                    setRewardForm({
                      title: reward.title,
                      description: isLockedText(reward.description) ? '' : reward.description,
                      categoryId: reward.categoryId ?? '',
                      pointCost: reward.pointCost,
                    })
                  }}
                  onApply={() =>
                    void applyRewardManually({
                      relationshipId: activeRelationship.id,
                      rewardId: reward.id,
                      targetUserId,
                      appliedByUserId: user.id,
                      note: applyNote,
                    }).then(refresh)
                  }
                />
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Punishments</p>
            <ul className="mt-2 space-y-2">
              {activePunishments.map((punishment) => (
                <CatalogCard
                  key={punishment.id}
                  title={punishment.title}
                  description={punishment.description}
                  footer={`severity ${punishment.severity}`}
                  locked={isLockedText(punishment.description)}
                  onEdit={() => {
                    setPunishmentEditingId(punishment.id)
                    setPunishmentForm({
                      title: punishment.title,
                      description: isLockedText(punishment.description)
                        ? ''
                        : punishment.description,
                      categoryId: punishment.categoryId ?? '',
                      severity: punishment.severity,
                    })
                  }}
                  onApply={() =>
                    void applyPunishmentManually({
                      relationshipId: activeRelationship.id,
                      punishmentId: punishment.id,
                      targetUserId,
                      appliedByUserId: user.id,
                      note: applyNote,
                    }).then(refresh)
                  }
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">History</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No rewards or punishments applied yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {history.slice(0, 40).map((entry) => {
              const target = activeRelationship.members.find((m) => m.userId === entry.targetUserId)
              const by = activeRelationship.members.find((m) => m.userId === entry.appliedByUserId)
              return (
                <li
                  key={entry.id}
                  className="rounded-md border border-stone-800 bg-stone-950/40 p-3"
                >
                  <p className="text-stone-200">
                    {entry.itemType === 'reward' ? 'Reward' : 'Punishment'}: {entry.itemTitle}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {entry.source} · {target?.displayName ?? 'Unknown target'} · by{' '}
                    {by?.displayName ?? 'Unknown'} ·{' '}
                    {formatLocalDateKey(entry.appliedAt.slice(0, 10))}
                  </p>
                  {entry.note ? <p className="mt-1 text-stone-400">{entry.note}</p> : null}
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

function CatalogCard(props: {
  title: string
  description: string
  footer: string
  locked: boolean
  onEdit: () => void
  onApply: () => void
}) {
  return (
    <li className="rounded-md border border-stone-800 bg-stone-950/40 p-3">
      <p className="font-medium text-stone-100">{props.title}</p>
      <p className="mt-1 text-sm text-stone-400">{props.description}</p>
      {props.locked ? (
        <NavLink to="/settings" className="mt-1 inline-block text-xs text-rose-400 hover:text-rose-300">
          Unlock in Settings
        </NavLink>
      ) : null}
      <p className="mt-2 text-xs text-stone-500">{props.footer}</p>
      <div className="mt-3 flex gap-3 text-xs">
        <button type="button" className="text-stone-400 hover:text-stone-200" onClick={props.onEdit}>
          Edit
        </button>
        <button type="button" className="text-rose-400 hover:text-rose-300" onClick={props.onApply}>
          Apply
        </button>
      </div>
    </li>
  )
}
