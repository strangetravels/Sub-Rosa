import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  claimSealedContentKey,
  deliverContentKeyToPendingMembers,
  getRelationshipSafetyNumber,
  needsSealedKeyClaim,
  unlockRelationshipContentKey,
  unlockWithRecoveryPhrase,
} from '@/features/crypto/cryptoService'
import {
  clearAllPendingPassphrases,
  clearPendingPassphrase,
  peekPendingPassphrase,
  rememberPendingPassphrase,
} from '@/features/crypto/pendingPassphrase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Relationship, RelationshipCrypto, RelationshipRole } from '@/types/models'

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
  claimActiveSealedKey: (passphrase: string) => Promise<void>
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
  const relationshipsRef = useRef(relationships)
  const syncInFlight = useRef(false)
  const pendingResync = useRef(false)

  relationshipsRef.current = relationships

  useEffect(() => {
    if (!user) {
      setRelationships([])
      setActiveId(null)
      setHydratedForUserId(null)
      clearAllPendingPassphrases()
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

  const applyCryptoUpdate = useCallback(
    async (relationshipId: string, crypto: RelationshipCrypto) => {
      const updated = await updateRelationshipCrypto(relationshipId, crypto)
      setRelationships((prev) =>
        prev.map((rel) => (rel.id === updated.id ? updated : rel)),
      )
      relationshipsRef.current = relationshipsRef.current.map((rel) =>
        rel.id === updated.id ? updated : rel,
      )
      return updated
    },
    [],
  )

  const runCryptoHydration = useCallback(async () => {
    if (!user) return
    if (syncInFlight.current) {
      pendingResync.current = true
      return
    }

    syncInFlight.current = true
    try {
      do {
        pendingResync.current = false
        const list = relationshipsRef.current

        for (const rel of list) {
          const delivered = await deliverContentKeyToPendingMembers({
            relationship: rel,
            senderUserId: user.id,
          })
          if (delivered) {
            await applyCryptoUpdate(rel.id, delivered)
            pendingResync.current = true
            break
          }

          if (!needsSealedKeyClaim(rel, user.id)) continue
          const passphrase = peekPendingPassphrase(rel.id)
          if (!passphrase) continue

          const claimed = await claimSealedContentKey({
            relationship: rel,
            userId: user.id,
            passphrase,
          })
          await applyCryptoUpdate(rel.id, claimed)
          clearPendingPassphrase(rel.id)
          pendingResync.current = true
          break
        }
      } while (pendingResync.current)
    } finally {
      syncInFlight.current = false
    }
  }, [user, applyCryptoUpdate])

  useEffect(() => {
    if (!user || loading) return
    void runCryptoHydration()
  }, [user, loading, relationships, runCryptoHydration])

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
        if (joined.awaitingKeyDelivery) {
          rememberPendingPassphrase(joined.relationship.id, passphrase)
        }
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
        const delivered = await deliverContentKeyToPendingMembers({
          relationship: activeRelationship,
          senderUserId: user.id,
        })
        if (delivered) {
          await applyCryptoUpdate(activeRelationship.id, delivered)
        }
      },
      async claimActiveSealedKey(passphrase) {
        if (!user || !activeRelationship) throw new Error('No active relationship.')
        const claimed = await claimSealedContentKey({
          relationship: activeRelationship,
          userId: user.id,
          passphrase,
        })
        await applyCryptoUpdate(activeRelationship.id, claimed)
        clearPendingPassphrase(activeRelationship.id)
      },
      async restoreActiveRelationshipWithRecovery(recoveryPhrase, newPassphrase) {
        if (!user || !activeRelationship) throw new Error('No active relationship.')
        const restored = await unlockWithRecoveryPhrase({
          relationship: activeRelationship,
          recoveryPhrase,
          newPassphrase,
          userId: user.id,
        })
        const updated = await applyCryptoUpdate(activeRelationship.id, restored.crypto)
        const delivered = await deliverContentKeyToPendingMembers({
          relationship: updated,
          senderUserId: user.id,
        })
        if (delivered) {
          await applyCryptoUpdate(activeRelationship.id, delivered)
        }
      },
      async deliverPendingKeys() {
        if (!user || !activeRelationship) return
        const nextCrypto = await deliverContentKeyToPendingMembers({
          relationship: activeRelationship,
          senderUserId: user.id,
        })
        if (!nextCrypto) return
        await applyCryptoUpdate(activeRelationship.id, nextCrypto)
      },
      async getActiveSafetyNumber() {
        if (!activeRelationship) return null
        return getRelationshipSafetyNumber(activeRelationship)
      },
    }),
    [relationships, activeRelationship, loading, user, applyCryptoUpdate],
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
