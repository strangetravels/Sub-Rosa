import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import {
  formatPercent,
  type StatsGranularity,
  type StatsRangeDays,
} from '@/features/stats/statsLogic'
import { useStatsData } from '@/features/stats/useStatsData'

function SummaryCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-50">{props.value}</p>
      {props.hint ? <p className="mt-1 text-xs text-stone-500">{props.hint}</p> : null}
    </div>
  )
}

function EmptyTip(props: { children: ReactNode }) {
  return <p className="mt-4 text-sm text-stone-500">{props.children}</p>
}

function BarChart(props: {
  title: string
  subtitle?: string
  series: Array<{ label: string; values: Array<{ key: string; value: number; color: string }> }>
  emptyTip?: ReactNode
}) {
  const max = Math.max(
    1,
    ...props.series.flatMap((s) => s.values.map((v) => v.value)),
  )
  const showEvery = props.series.length > 14 ? Math.ceil(props.series.length / 7) : 1
  const empty = props.series.every((s) => s.values.every((v) => v.value === 0))

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
      <h3 className="text-sm font-medium text-stone-200">{props.title}</h3>
      {props.subtitle ? <p className="mt-1 text-xs text-stone-500">{props.subtitle}</p> : null}
      {empty ? (
        <EmptyTip>{props.emptyTip ?? 'No data in this range.'}</EmptyTip>
      ) : (
        <div className="mt-4 flex h-40 items-end gap-1">
          {props.series.map((bucket, idx) => (
            <div key={bucket.label + idx} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                {bucket.values.map((v) => (
                  <div
                    key={v.key}
                    className="w-full max-w-[10px] rounded-t-sm"
                    style={{
                      height: `${Math.max(v.value > 0 ? 4 : 0, (v.value / max) * 100)}%`,
                      backgroundColor: v.color,
                      opacity: v.value === 0 ? 0.15 : 1,
                    }}
                    title={`${v.key}: ${v.value}`}
                  />
                ))}
              </div>
              {idx % showEvery === 0 ? (
                <span className="truncate text-[10px] text-stone-500">{bucket.label}</span>
              ) : (
                <span className="h-3" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BreakdownBars(props: {
  title: string
  items: Array<{ label: string; value: number; color: string }>
  emptyTip?: ReactNode
}) {
  const max = Math.max(1, ...props.items.map((i) => i.value))
  const empty = props.items.every((i) => i.value === 0)
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
      <h3 className="text-sm font-medium text-stone-200">{props.title}</h3>
      {empty ? (
        <EmptyTip>{props.emptyTip ?? 'No data in this range.'}</EmptyTip>
      ) : (
        <ul className="mt-4 space-y-3">
          {props.items.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-300">{item.label}</span>
                <span className="text-stone-100">{item.value}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-stone-800">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const RANGES: StatsRangeDays[] = [7, 30, 90]
const GRANULARITIES: StatsGranularity[] = ['day', 'week', 'month']

export function StatsPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const members = activeRelationship?.members ?? []
  const {
    rangeDays,
    setRangeDays,
    granularity,
    setGranularity,
    mineOnly,
    setMineOnly,
    loading,
    habitStats,
    habitChartDays,
    pointsStats,
    pointsChartDays,
    catalogBreakdown,
    journalStats,
    journalChartDays,
    journalStreak,
    ruleChartDays,
    perHabit,
    memberComparisons,
    csv,
  } = useStatsData(activeRelationship?.id, user?.id, members)

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Stats</h2>
        <p className="mt-2 text-stone-400">Select an active relationship first.</p>
      </section>
    )
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sub-rosa-stats-${rangeDays}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const grainLabel =
    granularity === 'day' ? 'per day' : granularity === 'week' ? 'per week' : 'per month'

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Stats</h2>
          <p className="mt-2 text-stone-400">
            Completion rates, points trends, rewards & punishments, and journaling activity for{' '}
            {activeRelationship.name}.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
          onClick={downloadCsv}
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-md border border-stone-700 p-1">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              className={[
                'rounded px-2.5 py-1 text-xs',
                rangeDays === days
                  ? 'bg-stone-800 text-rose-300'
                  : 'text-stone-400 hover:text-stone-200',
              ].join(' ')}
              onClick={() => setRangeDays(days)}
            >
              {days}d
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md border border-stone-700 p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              className={[
                'rounded px-2.5 py-1 text-xs capitalize',
                granularity === g
                  ? 'bg-stone-800 text-rose-300'
                  : 'text-stone-400 hover:text-stone-200',
              ].join(' ')}
              onClick={() => setGranularity(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-stone-400">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          My data only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Habit rate"
              value={formatPercent(habitStats.overallRate)}
              hint={`${habitStats.totalCompleted}/${habitStats.totalExpected} due slots`}
            />
            <SummaryCard
              label="Points net"
              value={String(pointsStats.net)}
              hint={`+${pointsStats.earned} / −${pointsStats.spent}`}
            />
            <SummaryCard
              label="Journal streak"
              value={String(journalStreak)}
              hint={`${journalStats.totalEntries} entries · ${journalStats.activeDays} days`}
            />
            <SummaryCard
              label="Rule violations"
              value={String(catalogBreakdown.ruleViolations)}
              hint={`${catalogBreakdown.habitMisses} habit misses`}
            />
          </div>

          <BarChart
            title="Habit completions"
            subtitle={`Completed vs expected due slots (${grainLabel})`}
            series={habitChartDays.map((d) => ({
              label: d.label,
              values: [
                { key: 'completed', value: d.completed, color: '#fb7185' },
                { key: 'expected', value: d.expected, color: '#44403c' },
              ],
            }))}
            emptyTip={
              <>
                No habit activity yet.{' '}
                <NavLink to="/habits" className="text-rose-400 hover:text-rose-300">
                  Add a habit
                </NavLink>
              </>
            }
          />

          <BarChart
            title="Points earned vs spent"
            subtitle={`Ledger totals (${grainLabel})`}
            series={pointsChartDays.map((d) => ({
              label: d.label,
              values: [
                { key: 'earned', value: d.earned, color: '#34d399' },
                { key: 'spent', value: d.spent, color: '#f43f5e' },
              ],
            }))}
            emptyTip={
              <>
                No points activity yet.{' '}
                <NavLink to="/points" className="text-rose-400 hover:text-rose-300">
                  Open points
                </NavLink>
              </>
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <BreakdownBars
              title="Rewards & punishments"
              items={[
                { label: 'Rewards applied', value: catalogBreakdown.rewards, color: '#34d399' },
                {
                  label: 'Punishments applied',
                  value: catalogBreakdown.punishments,
                  color: '#f43f5e',
                },
                {
                  label: 'Rule violations',
                  value: catalogBreakdown.ruleViolations,
                  color: '#fbbf24',
                },
                {
                  label: 'Habit misses',
                  value: catalogBreakdown.habitMisses,
                  color: '#a78bfa',
                },
              ]}
              emptyTip={
                <>
                  Nothing applied yet.{' '}
                  <NavLink to="/rewards" className="text-rose-400 hover:text-rose-300">
                    Open rewards
                  </NavLink>
                </>
              }
            />
            <BarChart
              title="Journaling activity"
              subtitle={`Entries (${grainLabel})`}
              series={journalChartDays.map((d) => ({
                label: d.label,
                values: [{ key: 'entries', value: d.entries, color: '#38bdf8' }],
              }))}
              emptyTip={
                <>
                  No journal entries in this range.{' '}
                  <NavLink to="/journal" className="text-rose-400 hover:text-rose-300">
                    Write an entry
                  </NavLink>
                </>
              }
            />
          </div>

          <BarChart
            title="Rule violation trend"
            subtitle={`Punishments from rule violations (${grainLabel})`}
            series={ruleChartDays.map((d) => ({
              label: d.label,
              values: [{ key: 'violations', value: d.count, color: '#fbbf24' }],
            }))}
            emptyTip={
              <>
                No rule violations in this range.{' '}
                <NavLink to="/rules" className="text-rose-400 hover:text-rose-300">
                  Review rules
                </NavLink>
              </>
            }
          />

          <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
            <h3 className="text-sm font-medium text-stone-200">Per-habit breakdown</h3>
            {perHabit.length === 0 ? (
              <EmptyTip>
                No active habits.{' '}
                <NavLink to="/habits" className="text-rose-400 hover:text-rose-300">
                  Add a habit
                </NavLink>
              </EmptyTip>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">Habit</th>
                      <th className="pb-2 pr-3 font-medium">Assignee</th>
                      <th className="pb-2 pr-3 font-medium">Done</th>
                      <th className="pb-2 pr-3 font-medium">Expected</th>
                      <th className="pb-2 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perHabit.map((row) => {
                      const assignee = members.find((m) => m.userId === row.assignedToUserId)
                      return (
                        <tr key={row.habitId} className="border-t border-stone-800">
                          <td className="py-2 pr-3 text-stone-100">{row.title}</td>
                          <td className="py-2 pr-3 text-stone-400">
                            {assignee?.displayName ?? 'Unknown'}
                          </td>
                          <td className="py-2 pr-3 text-stone-300">{row.completed}</td>
                          <td className="py-2 pr-3 text-stone-300">{row.expected}</td>
                          <td className="py-2 text-stone-100">{formatPercent(row.rate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!mineOnly && members.length > 1 ? (
            <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
              <h3 className="text-sm font-medium text-stone-200">Members in this relationship</h3>
              <p className="mt-1 text-xs text-stone-500">
                Comparison is limited to partners in {activeRelationship.name}.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {memberComparisons.map((m) => (
                  <div
                    key={m.userId}
                    className={[
                      'rounded-md border p-3',
                      m.userId === user.id
                        ? 'border-rose-800 bg-rose-950/20'
                        : 'border-stone-700 bg-stone-950/30',
                    ].join(' ')}
                  >
                    <p className="text-sm font-medium text-stone-100">
                      {m.displayName}
                      {m.userId === user.id ? ' (you)' : ''}
                    </p>
                    <dl className="mt-2 space-y-1 text-xs text-stone-400">
                      <div className="flex justify-between gap-2">
                        <dt>Habit rate</dt>
                        <dd className="text-stone-200">{formatPercent(m.habitRate)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Points net</dt>
                        <dd className="text-stone-200">{m.pointsNet}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Journal entries</dt>
                        <dd className="text-stone-200">{m.journalEntries}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Journal streak</dt>
                        <dd className="text-stone-200">{m.journalStreak}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
