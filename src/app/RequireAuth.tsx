import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRelationship } from '@/features/relationships/RelationshipProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireRelationship() {
  const { relationships, loading } = useRelationship()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    )
  }

  if (relationships.length === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
