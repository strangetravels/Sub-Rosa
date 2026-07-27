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
import type { Relationship, RelationshipRole, UserProfile } from '@/types/models'

const ACTIVE_KEY = 'subrosa.activeRelationshipId'

export function notifyDemoRelationshipsChanged(): void {
  window.dispatchEvent(new Event('subrosa-demo-relationships'))
}

function memberIds(relationship: Relationship): string[] {
  return relationship.members.map((m) => m.userId)
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

export async function createRelationship(input: {
  user: UserProfile
  name: string
  role: RelationshipRole
}): Promise<Relationship> {
  const relationship: Relationship = {
    id: createId('rel'),
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
    return relationship
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')

  await setDoc(doc(db, 'relationships', relationship.id), {
    ...relationship,
    memberIds: memberIds(relationship),
  })
  localStorage.setItem(ACTIVE_KEY, relationship.id)
  return relationship
}

export async function joinRelationshipByInvite(input: {
  user: UserProfile
  inviteCode: string
  role: RelationshipRole
}): Promise<Relationship> {
  const code = input.inviteCode.trim().toUpperCase()

  if (isDemoMode()) {
    const state = readDemoState()
    const index = state.relationships.findIndex((r) => r.inviteCode === code)
    if (index < 0) throw new Error('Invite code not found.')
    const current = state.relationships[index]!

    let joined: Relationship
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

    updateDemoState((s) => {
      const relationships = [...s.relationships]
      const idx = relationships.findIndex((r) => r.id === joined.id)
      if (idx >= 0) relationships[idx] = joined
      return {
        ...s,
        relationships,
        activeRelationshipIdByUser: {
          ...s.activeRelationshipIdByUser,
          [input.user.id]: joined.id,
        },
      }
    })
    localStorage.setItem(ACTIVE_KEY, joined.id)
    notifyDemoRelationshipsChanged()
    return joined
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')

  const snap = await getDocs(
    query(collection(db, 'relationships'), where('inviteCode', '==', code)),
  )
  if (snap.empty) throw new Error('Invite code not found.')
  const docSnap = snap.docs[0]!
  const current = docSnap.data() as Relationship & { memberIds?: string[] }
  if (memberIds(current).includes(input.user.id)) {
    localStorage.setItem(ACTIVE_KEY, current.id)
    return current
  }
  if (current.members.length >= 2) {
    throw new Error('This relationship already has two members.')
  }

  const next: Relationship = {
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
    members: next.members,
    memberIds: memberIds(next),
  })
  localStorage.setItem(ACTIVE_KEY, next.id)
  return next
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
