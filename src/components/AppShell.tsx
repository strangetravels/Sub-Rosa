import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { countUnreadMessages } from '@/features/chat/chatService'
import { useChatData } from '@/features/chat/useChatData'
import { NotificationBell } from '@/features/notifications/NotificationCenter'
import { useRelationship } from '@/features/relationships/RelationshipProvider'
import { useSecurity } from '@/features/security/SecurityProvider'
import { APP_NAME, DISCREET_APP_NAME } from '@/features/security/securitySettings'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/habits', label: 'Habits' },
  { to: '/rules', label: 'Rules' },
  { to: '/rewards', label: 'Rewards' },
  { to: '/points', label: 'Points' },
  { to: '/journal', label: 'Journal' },
  { to: '/chat', label: 'Chat' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
] as const

export function AppShell() {
  const { user } = useAuth()
  const { relationships, activeRelationship, setActiveRelationship } = useRelationship()
  const { settings } = useSecurity()
  const { messages } = useChatData(activeRelationship?.id, user?.id, { markRead: false })
  const unread = user ? countUnreadMessages(messages, user.id) : 0
  const brandName = settings?.discreetMode ? DISCREET_APP_NAME : APP_NAME

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="border-b border-stone-700 bg-stone-900 md:w-56 md:border-b-0 md:border-r">
        <div className="px-4 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Workspace</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-stone-50">{brandName}</h1>
          {user ? (
            <p className="mt-1 truncate text-sm text-stone-400">{user.displayName}</p>
          ) : null}
        </div>

        {relationships.length > 0 ? (
          <div className="px-3 pb-3">
            <label className="block text-xs uppercase tracking-wide text-stone-500">
              Relationship
              <select
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-950 px-2 py-1.5 text-sm text-stone-200 outline-none focus:border-rose-500"
                value={activeRelationship?.id ?? ''}
                onChange={(e) => void setActiveRelationship(e.target.value)}
              >
                {relationships.map((rel) => (
                  <option key={rel.id} value={rel.id}>
                    {rel.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-stone-800 text-rose-400'
                    : 'text-stone-300 hover:bg-stone-800/70 hover:text-stone-50',
                ].join(' ')
              }
            >
              <span>{item.label}</span>
              {item.to === '/chat' && unread > 0 ? (
                <span className="rounded-md bg-rose-900/80 px-1.5 py-0.5 text-[10px] font-medium text-rose-100">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <NotificationBell relationshipId={activeRelationship?.id} userId={user?.id} />
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
