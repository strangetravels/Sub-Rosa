import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'

export function DashboardPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const myMember = activeRelationship?.members.find((m) => m.userId === user?.id)

  return (
    <section className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Dashboard</h2>
      <p className="mt-2 text-stone-400">
        Today’s habits, points balance, and quick actions will live here.
      </p>

      {activeRelationship ? (
        <div className="mt-8 rounded-lg border border-stone-700 bg-stone-900/50 p-5 text-sm">
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
        <div className="mt-8 rounded-lg border border-dashed border-stone-600 p-6 text-sm text-stone-500">
          No active relationship selected.
        </div>
      )}
    </section>
  )
}
