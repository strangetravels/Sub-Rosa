import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  vi.stubEnv('VITE_FIREBASE_API_KEY', '')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '')
  vi.stubEnv('VITE_FIREBASE_APP_ID', '')
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  // Reset in-memory IndexedDB between tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idb = indexedDB as any
  if (typeof idb?.deleteDatabase === 'function') {
    idb.deleteDatabase('subrosa-crypto-v1')
  }
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
