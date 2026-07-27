import { describe, expect, it } from 'vitest'
import { createId, createInviteCode } from '@/lib/id'

describe('createId', () => {
  it('returns a uuid-like id without a prefix', () => {
    const id = createId()
    expect(id.length).toBeGreaterThan(8)
    expect(id).not.toContain('_')
  })

  it('prefixes ids when requested', () => {
    const id = createId('user')
    expect(id.startsWith('user_')).toBe(true)
  })

  it('generates unique values', () => {
    const a = createId()
    const b = createId()
    expect(a).not.toBe(b)
  })
})

describe('createInviteCode', () => {
  it('returns a 6-character invite code from the safe alphabet', () => {
    const code = createInviteCode()
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it('generates distinct codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => createInviteCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
