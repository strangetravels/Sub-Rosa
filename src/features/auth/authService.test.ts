import { describe, expect, it, vi } from 'vitest'
import {
  signIn,
  signOut,
  signUp,
  subscribeToAuth,
} from '@/features/auth/authService'
import { readDemoState } from '@/lib/demo/store'

describe('authService (demo mode)', () => {
  it('signs up a new user and sets the session', async () => {
    const profile = await signUp('Alex@Example.com', 'secret123', 'Alex')
    expect(profile.email).toBe('alex@example.com')
    expect(profile.displayName).toBe('Alex')
    expect(readDemoState().sessionUserId).toBe(profile.id)
    expect(readDemoState().accounts[profile.id]?.password).toBe('secret123')
  })

  it('rejects duplicate emails', async () => {
    await signUp('dup@example.com', 'secret123', 'One')
    await expect(signUp('dup@example.com', 'other', 'Two')).rejects.toThrow(
      'An account with that email already exists.',
    )
  })

  it('signs in with valid credentials', async () => {
    await signUp('login@example.com', 'secret123', 'Login')
    await signOut()
    expect(readDemoState().sessionUserId).toBeNull()

    const profile = await signIn('login@example.com', 'secret123')
    expect(profile.displayName).toBe('Login')
    expect(readDemoState().sessionUserId).toBe(profile.id)
  })

  it('rejects invalid credentials', async () => {
    await signUp('bad@example.com', 'secret123', 'Bad')
    await expect(signIn('bad@example.com', 'wrong')).rejects.toThrow(
      'Invalid email or password.',
    )
  })

  it('notifies subscribers on auth changes', async () => {
    const seen: Array<string | null> = []
    const unsubscribe = subscribeToAuth((user) => {
      seen.push(user?.id ?? null)
    })

    const profile = await signUp('sub@example.com', 'secret123', 'Sub')
    await signOut()
    unsubscribe()

    expect(seen[0]).toBeNull()
    expect(seen).toContain(profile.id)
    expect(seen.at(-1)).toBeNull()
  })

  it('cleans up demo auth listeners', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const unsubscribe = subscribeToAuth(() => undefined)
    unsubscribe()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('subrosa-demo-auth', expect.any(Function))
  })
})
