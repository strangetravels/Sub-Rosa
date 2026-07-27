import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createRelationship as createRelationshipRecord,
  joinRelationshipByInvite,
  setActiveRelationshipId,
  subscribeToRelationships,
} from '@/features/relationships/relationshipService'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Relationship, RelationshipRole } from '@/types/models'

type RelationshipContextValue = {
  relationships: Relationship[]
  activeRelationship: Relationship | null
  loading: boolean
  setActiveRelationship: (relationshipId: string) => Promise<void>
  createRelationship: (name: string, role: RelationshipRole) => Promise<Relationship>
  joinRelationship: (inviteCode: string, role: RelationshipRole) => Promise<Relationship>
}

const RelationshipContext = createContext<RelationshipContextValue | null>(null)

export function RelationshipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hydratedForUserId, setHydratedForUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setRelationships([])
      setActiveId(null)
      setHydratedForUserId(null)
      return
    }

    setHydratedForUserId(null)
    return subscribeToRelationships(user.id, (list, nextActiveId) => {
      setRelationships(list)
      setActiveId(nextActiveId)
      setHydratedForUserId(user.id)
    })
  }, [user])

  const loading = Boolean(user) && hydratedForUserId !== user?.id

  const activeRelationship = useMemo(
    () => relationships.find((r) => r.id === activeId) ?? null,
    [relationships, activeId],
  )

  const value = useMemo<RelationshipContextValue>(
    () => ({
      relationships,
      activeRelationship,
      loading,
      async setActiveRelationship(relationshipId) {
        if (!user) return
        await setActiveRelationshipId(user.id, relationshipId)
        setActiveId(relationshipId)
      },
      async createRelationship(name, role) {
        if (!user) throw new Error('Not signed in.')
        const created = await createRelationshipRecord({ user, name, role })
        setRelationships((prev) => {
          if (prev.some((r) => r.id === created.id)) return prev
          return [...prev, created]
        })
        setActiveId(created.id)
        setHydratedForUserId(user.id)
        return created
      },
      async joinRelationship(inviteCode, role) {
        if (!user) throw new Error('Not signed in.')
        const joined = await joinRelationshipByInvite({ user, inviteCode, role })
        setRelationships((prev) => {
          const without = prev.filter((r) => r.id !== joined.id)
          return [...without, joined]
        })
        setActiveId(joined.id)
        setHydratedForUserId(user.id)
        return joined
      },
    }),
    [relationships, activeRelationship, loading, user],
  )

  return (
    <RelationshipContext.Provider value={value}>{children}</RelationshipContext.Provider>
  )
}

export function useRelationship(): RelationshipContextValue {
  const ctx = useContext(RelationshipContext)
  if (!ctx) throw new Error('useRelationship must be used within RelationshipProvider')
  return ctx
}
