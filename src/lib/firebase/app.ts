import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { isDemoMode, readFirebaseConfig } from '@/lib/firebase/config'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (isDemoMode()) return null
  if (app) return app

  const config = readFirebaseConfig()
  if (!config) return null

  app = getApps().length ? getApps()[0]! : initializeApp(config)
  return app
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  auth = getAuth(firebaseApp)
  return auth
}

export function getFirebaseDb(): Firestore | null {
  if (db) return db
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  db = getFirestore(firebaseApp)
  return db
}
