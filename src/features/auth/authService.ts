import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/app'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import type { UserProfile } from '@/types/models'

function toProfile(user: FirebaseUser, displayName?: string): UserProfile {
  return {
    id: user.uid,
    email: user.email ?? '',
    displayName: displayName || user.displayName || user.email?.split('@')[0] || 'User',
    createdAt: user.metadata.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : new Date().toISOString(),
  }
}

async function ensureUserDoc(profile: UserProfile): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  const ref = doc(db, 'users', profile.id)
  const existing = await getDoc(ref)
  if (!existing.exists()) {
    await setDoc(ref, profile)
  }
}

export function notifyDemoAuthChanged(): void {
  window.dispatchEvent(new Event('subrosa-demo-auth'))
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<UserProfile> {
  if (isDemoMode()) {
    const normalized = email.trim().toLowerCase()
    const name = displayName.trim() || normalized.split('@')[0] || 'User'
    const profile: UserProfile = {
      id: createId('user'),
      email: normalized,
      displayName: name,
      createdAt: new Date().toISOString(),
    }

    updateDemoState((state) => {
      if (Object.values(state.accounts).some((a) => a.profile.email === normalized)) {
        throw new Error('An account with that email already exists.')
      }
      return {
        ...state,
        accounts: {
          ...state.accounts,
          [profile.id]: { password, profile },
        },
        sessionUserId: profile.id,
      }
    })
    notifyDemoAuthChanged()
    return profile
  }

  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase Auth is not configured.')

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(credential.user, { displayName: displayName.trim() })
  const profile = toProfile(credential.user, displayName.trim())
  await ensureUserDoc(profile)
  return profile
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  if (isDemoMode()) {
    const normalized = email.trim().toLowerCase()
    const state = readDemoState()
    const account = Object.values(state.accounts).find((a) => a.profile.email === normalized)
    if (!account || account.password !== password) {
      throw new Error('Invalid email or password.')
    }
    updateDemoState((s) => ({ ...s, sessionUserId: account.profile.id }))
    notifyDemoAuthChanged()
    return account.profile
  }

  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase Auth is not configured.')

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const profile = toProfile(credential.user)
  await ensureUserDoc(profile)
  return profile
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) {
    updateDemoState((s) => ({ ...s, sessionUserId: null }))
    notifyDemoAuthChanged()
    return
  }
  const auth = getFirebaseAuth()
  if (!auth) return
  await firebaseSignOut(auth)
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  if (isDemoMode()) {
    const emit = () => {
      const state = readDemoState()
      const user = state.sessionUserId
        ? (state.accounts[state.sessionUserId]?.profile ?? null)
        : null
      callback(user)
    }
    emit()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'subrosa.demo.v1') emit()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('subrosa-demo-auth', emit)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('subrosa-demo-auth', emit)
    }
  }

  const auth = getFirebaseAuth()
  if (!auth) {
    callback(null)
    return () => undefined
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null)
      return
    }
    const profile = toProfile(firebaseUser)
    await ensureUserDoc(profile)
    callback(profile)
  })
}
