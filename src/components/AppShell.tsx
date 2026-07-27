import { NavLink, Outlet } from 'react-router-dom'

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
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="border-b border-stone-700 bg-stone-900 md:w-56 md:border-b-0 md:border-r">
        <div className="px-4 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Workspace</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-stone-50">Sub Rosa</h1>
          <p className="mt-1 text-sm text-stone-400">Scaffold shell</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-stone-800 text-rose-400'
                    : 'text-stone-300 hover:bg-stone-800/70 hover:text-stone-50',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
