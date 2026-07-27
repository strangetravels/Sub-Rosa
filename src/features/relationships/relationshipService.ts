import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId, createInviteCode } from '@/lib/id'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import {
  acceptRelationshipCrypto,
  bootstrapRelationshipCrypto,
} from '@/features/crypto/cryptoService'
import type {
  Relationship,
  RelationshipCrypto,
  RelationshipRole,
  UserProfile,
} from '@/types/models'

const ACTIVE_KEY = 'subrosa.activeRelationshipId'

export function notifyDemoRelationshipsChanged(): void {
  window.dispatchEvent(new Event('subrosa-demo-relationships'))
}

function memberIds(relationship: Relationship): string[] {
  return relationship.members.map((m) => m.userId)
}

async function persistRelationship(relationship: Relationship): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((state) => {
      const relationships = [...state.relationships]
      const idx = relationships.findIndex((r) => r.id === relationship.id)
      if (idx >= 0) relationships[idx] = relationship
      else relationships.push(relationship)
      return { ...state, relationships }
    })
    notifyDemoRelationshipsChanged()
    return
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', relationship.id),
    {
      ...relationship,
      memberIds: memberIds(relationship),
    },
    { merge: true },
  )
}

export async function updateRelationshipCrypto(
  relationshipId: string,
  crypto: RelationshipCrypto,
): Promise<Relationship> {
  if (isDemoMode()) {
    let updated: Relationship | null = null
    updateDemoState((state) => {
      const relationships = state.relationships.map((rel) => {
        if (rel.id !== relationshipId) return rel
        updated = { ...rel, crypto }
        return updated
      })
      return { ...state, relationships }
    })
    notifyDemoRelationshipsChanged()
    if (!updated) throw new Error('Relationship not found.')
    return updated
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(doc(db, 'relationships', relationshipId), { crypto })
  const snap = await getDoc(doc(db, 'relationships', relationshipId))
  return snap.data() as Relationship
}

export async function listRelationshipsForUser(userId: string): Promise<Relationship[]> {
  if (isDemoMode()) {
    return readDemoState().relationships.filter((r) => memberIds(r).includes(userId))
  }

  const db = getFirebaseDb()
  if (!db) return []

  const snap = await getDocs(
    query(collection(db, 'relationships'), where('memberIds', 'array-contains', userId)),
  )
  return snap.docs.map((d) => d.data() as Relationship)
}

export type CreateRelationshipResult = {
  relationship: Relationship
  recoveryPhrase: string
}

export async function createRelationship(input: {
  user: UserProfile
  name: string
  role: RelationshipRole
  passphrase: string
}): Promise<CreateRelationshipResult> {
  const relationshipId = createId('rel')
  const secure = await bootstrapRelationshipCrypto({
    relationshipId,
    user: input.user,
    passphrase: input.passphrase,
  })

  const relationship: Relationship = {
    id: relationshipId,
    name: input.name.trim() || 'Our dynamic',
    status: 'active',
    members: [
      {
        userId: input.user.id,
        role: input.role,
        displayName: input.user.displayName,
      },
    ],
    inviteCode: createInviteCode(),
    createdAt: new Date().toISOString(),
    createdBy: input.user.id,
    crypto: secure.crypto,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      relationships: [...state.relationships, relationship],
      activeRelationshipIdByUser: {
        ...state.activeRelationshipIdByUser,
        [input.user.id]: relationship.id,
      },
    }))
    localStorage.setItem(ACTIVE_KEY, relationship.id)
    notifyDemoRelationshipsChanged()
    return { relationship, recoveryPhrase: secure.recoveryPhrase }
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')

  await setDoc(doc(db, 'relationships', relationship.id), {
    ...relationship,
    memberIds: memberIds(relationship),
  })
  localStorage.setItem(ACTIVE_KEY, relationship.id)
  return { relationship, recoveryPhrase: secure.recoveryPhrase }
}

export type JoinRelationshipResult = {
  relationship: Relationship
  safetyNumber: string
  awaitingKeyDelivery: boolean
}

export async function joinRelationshipByInvite(input: {
  user: UserProfile
  inviteCode: string
  role: RelationshipRole
  passphrase: string
}): Promise<JoinRelationshipResult> {
  const code = input.inviteCode.trim().toUpperCase()

  let joined: Relationship

  if (isDemoMode()) {
    const state = readDemoState()
    const index = state.relationships.findIndex((r) => r.inviteCode === code)
    if (index < 0) throw new Error('Invite code not found.')
    const current = state.relationships[index]!

    if (memberIds(current).includes(input.user.id)) {
      joined = current
    } else if (current.members.length >= 2) {
      throw new Error('This relationship already has two members.')
    } else {
      joined = {
        ...current,
        members: [
          ...current.members,
          {
            userId: input.user.id,
            role: input.role,
            displayName: input.user.displayName,
          },
        ],
      }
    }
  } else {
    const db = getFirebaseDb()
    if (!db) throw new Error('Firestore is not configured.')

    const snap = await getDocs(
      query(collection(db, 'relationships'), where('inviteCode', '==', code)),
    )
    if (snap.empty) throw new Error('Invite code not found.')
    const docSnap = snap.docs[0]!
    const current = docSnap.data() as Relationship & { memberIds?: string[] }
    if (memberIds(current).includes(input.user.id)) {
      joined = current
    } else if (current.members.length >= 2) {
      throw new Error('This relationship already has two members.')
    } else {
      joined = {
        ...current,
        members: [
          ...current.members,
          {
            userId: input.user.id,
            role: input.role,
            displayName: input.user.displayName,
          },
        ],
      }
      await updateDoc(doc(db, 'relationships', current.id), {
        members: joined.members,
        memberIds: memberIds(joined),
      })
    }
  }

  const secure = await acceptRelationshipCrypto({
    relationship: joined,
    user: input.user,
    passphrase: input.passphrase,
  })

  const withCrypto: Relationship = {
    ...joined,
    crypto: secure.crypto,
  }

  await persistRelationship(withCrypto)
  localStorage.setItem(ACTIVE_KEY, withCrypto.id)

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      activeRelationshipIdByUser: {
        ...state.activeRelationshipIdByUser,
        [input.user.id]: withCrypto.id,
      },
    }))
  }

  return {
    relationship: withCrypto,
    safetyNumber: secure.safetyNumber,
    awaitingKeyDelivery: secure.awaitingKeyDelivery,
  }
}

export async function getActiveRelationshipId(userId: string): Promise<string | null> {
  if (isDemoMode()) {
    const state = readDemoState()
    const stored = state.activeRelationshipIdByUser[userId]
    if (stored) return stored
    const first = state.relationships.find((r) => memberIds(r).includes(userId))
    return first?.id ?? null
  }

  const cached = localStorage.getItem(ACTIVE_KEY)
  if (cached) {
    const db = getFirebaseDb()
    if (db) {
      const snap = await getDoc(doc(db, 'relationships', cached))
      if (snap.exists()) {
        const data = snap.data() as Relationship
        if (memberIds(data).includes(userId)) return cached
      }
    }
  }

  const list = await listRelationshipsForUser(userId)
  return list[0]?.id ?? null
}

export async function setActiveRelationshipId(userId: string, relationshipId: string): Promise<void> {
  localStorage.setItem(ACTIVE_KEY, relationshipId)
  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      activeRelationshipIdByUser: {
        ...state.activeRelationshipIdByUser,
        [userId]: relationshipId,
      },
    }))
    notifyDemoRelationshipsChanged()
  }
}

export function subscribeToRelationships(
  userId: string,
  callback: (relationships: Relationship[], activeId: string | null) => void,
): () => void {
  if (isDemoMode()) {
    const emit = () => {
      void (async () => {
        const relationships = await listRelationshipsForUser(userId)
        const activeId = await getActiveRelationshipId(userId)
        callback(relationships, activeId)
      })()
    }
    emit()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'subrosa.demo.v1' || event.key === ACTIVE_KEY) emit()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('subrosa-demo-relationships', emit)
    window.addEventListener('subrosa-demo-auth', emit)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('subrosa-demo-relationships', emit)
      window.removeEventListener('subrosa-demo-auth', emit)
    }
  }

  let cancelled = false
  void (async () => {
    const relationships = await listRelationshipsForUser(userId)
    const activeId = await getActiveRelationshipId(userId)
    if (!cancelled) callback(relationships, activeId)
  })()

  return () => {
    cancelled = true
  }
}
