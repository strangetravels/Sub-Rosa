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
  updateRelationshipCrypto,
  type CreateRelationshipResult,
  type JoinRelationshipResult,
} from '@/features/relationships/relationshipService'
import {
  deliverContentKeyToPendingMembers,
  getRelationshipSafetyNumber,
  unlockRelationshipContentKey,
  unlockWithRecoveryPhrase,
} from '@/features/crypto/cryptoService'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Relationship, RelationshipRole } from '@/types/models'

type RelationshipContextValue = {
  relationships: Relationship[]
  activeRelationship: Relationship | null
  loading: boolean
  setActiveRelationship: (relationshipId: string) => Promise<void>
  createRelationship: (
    name: string,
    role: RelationshipRole,
    passphrase: string,
  ) => Promise<CreateRelationshipResult>
  joinRelationship: (
    inviteCode: string,
    role: RelationshipRole,
    passphrase: string,
  ) => Promise<JoinRelationshipResult>
  unlockActiveRelationship: (passphrase: string) => Promise<void>
  restoreActiveRelationshipWithRecovery: (
    recoveryPhrase: string,
    newPassphrase: string,
  ) => Promise<void>
  deliverPendingKeys: () => Promise<void>
  getActiveSafetyNumber: () => Promise<string | null>
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
      async createRelationship(name, role, passphrase) {
        if (!user) throw new Error('Not signed in.')
        const created = await createRelationshipRecord({
          user,
          name,
          role,
          passphrase,
        })
        setRelationships((prev) => {
          if (prev.some((r) => r.id === created.relationship.id)) {
            return prev.map((r) =>
              r.id === created.relationship.id ? created.relationship : r,
            )
          }
          return [...prev, created.relationship]
        })
        setActiveId(created.relationship.id)
        setHydratedForUserId(user.id)
        return created
      },
      async joinRelationship(inviteCode, role, passphrase) {
        if (!user) throw new Error('Not signed in.')
        const joined = await joinRelationshipByInvite({
          user,
          inviteCode,
          role,
          passphrase,
        })
        setRelationships((prev) => {
          const without = prev.filter((r) => r.id !== joined.relationship.id)
          return [...without, joined.relationship]
        })
        setActiveId(joined.relationship.id)
        setHydratedForUserId(user.id)
        return joined
      },
      async unlockActiveRelationship(passphrase) {
        if (!user || !activeRelationship) throw new Error('No active relationship.')
        await unlockRelationshipContentKey({
          relationship: activeRelationship,
          userId: user.id,
          passphrase,
        })
      },
      async restoreActiveRelationshipWithRecovery(recoveryPhrase, newPassphrase) {
        if (!user || !activeRelationship) throw new Error('No active relationship.')
        const restored = await unlockWithRecoveryPhrase({
          relationship: activeRelationship,
          recoveryPhrase,
          newPassphrase,
          userId: user.id,
        })
        const updated = await updateRelationshipCrypto(
          activeRelationship.id,
          restored.crypto,
        )
        setRelationships((prev) =>
          prev.map((rel) => (rel.id === updated.id ? updated : rel)),
        )
      },
      async deliverPendingKeys() {
        if (!user || !activeRelationship) return
        const nextCrypto = await deliverContentKeyToPendingMembers({
          relationship: activeRelationship,
          senderUserId: user.id,
        })
        if (!nextCrypto) return
        const updated = await updateRelationshipCrypto(activeRelationship.id, nextCrypto)
        setRelationships((prev) =>
          prev.map((rel) => (rel.id === updated.id ? updated : rel)),
        )
      },
      async getActiveSafetyNumber() {
        if (!activeRelationship) return null
        return getRelationshipSafetyNumber(activeRelationship)
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
