import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'

export function PartnersSettingsPage() {
  const { user, signOut } = useAuth()
  const { relationships, activeRelationship, setActiveRelationship } = useRelationship()

  const myRole = activeRelationship?.members.find((m) => m.userId === user?.id)?.role

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Settings</h2>
        <p className="mt-2 text-stone-400">
          Account, partner management, and active relationship.
        </p>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Account</h3>
        <p className="mt-2 text-sm text-stone-400">
          {user?.displayName} · {user?.email}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 hover:text-stone-100"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">Active relationship</h3>
        {activeRelationship ? (
          <div className="mt-3 space-y-2 text-sm text-stone-400">
            <p>
              <span className="text-stone-200">{activeRelationship.name}</span> · your role:{' '}
              {myRole}
            </p>
            <p>
              Invite code:{' '}
              <code className="rounded bg-stone-800 px-1.5 py-0.5 tracking-widest text-rose-300">
                {activeRelationship.inviteCode}
              </code>
            </p>
            <ul className="mt-2 space-y-1">
              {activeRelationship.members.map((member) => (
                <li key={member.userId}>
                  {member.displayName} ({member.role})
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No active relationship.</p>
        )}
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-5">
        <h3 className="text-sm font-medium text-stone-200">All relationships</h3>
        <ul className="mt-3 space-y-2">
          {relationships.map((rel) => (
            <li key={rel.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-stone-300">
                {rel.name}{' '}
                <span className="text-stone-500">
                  ({rel.members.length} member{rel.members.length === 1 ? '' : 's'})
                </span>
              </span>
              {rel.id === activeRelationship?.id ? (
                <span className="text-rose-400">Active</span>
              ) : (
                <button
                  type="button"
                  className="text-stone-400 hover:text-stone-200"
                  onClick={() => void setActiveRelationship(rel.id)}
                >
                  Switch
                </button>
              )}
            </li>
          ))}
        </ul>
        <NavLink
          to="/onboarding"
          className="mt-4 inline-block text-sm text-rose-400 hover:text-rose-300"
        >
          Create or join another
        </NavLink>
      </div>
    </section>
  )
}
