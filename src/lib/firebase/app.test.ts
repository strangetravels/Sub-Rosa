import { getApps } from 'firebase/app'
import { describe, expect, it, vi } from 'vitest'

describe('firebase app bootstrap', () => {
  it('does not initialize Firebase while in demo mode', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const { getFirebaseApp, getFirebaseAuth, getFirebaseDb } = await import('@/lib/firebase/app')
    expect(getFirebaseApp()).toBeNull()
    expect(getFirebaseAuth()).toBeNull()
    expect(getFirebaseDb()).toBeNull()
    expect(getApps()).toHaveLength(0)
  })
})
