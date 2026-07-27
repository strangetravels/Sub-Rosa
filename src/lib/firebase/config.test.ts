import { describe, expect, it, vi } from 'vitest'
import { isDemoMode, readFirebaseConfig } from '@/lib/firebase/config'

describe('readFirebaseConfig', () => {
  it('returns null when required fields are missing', () => {
    expect(readFirebaseConfig()).toBeNull()
  })

  it('returns config when required fields are present', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'example.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'example')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'example.appspot.com')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST')

    expect(readFirebaseConfig()).toEqual({
      apiKey: 'key',
      authDomain: 'example.firebaseapp.com',
      projectId: 'example',
      storageBucket: 'example.appspot.com',
      messagingSenderId: '123',
      appId: '1:123:web:abc',
      measurementId: 'G-TEST',
    })
  })
})

describe('isDemoMode', () => {
  it('is true when VITE_DEMO_MODE is true', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'example.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'example')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    expect(isDemoMode()).toBe(true)
  })

  it('is true when Firebase config is incomplete', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    expect(isDemoMode()).toBe(true)
  })

  it('is false when Firebase is configured and demo mode is off', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'example.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'example')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    expect(isDemoMode()).toBe(false)
  })
})
