import { describe, expect, it } from 'vitest'
import { readDemoState, updateDemoState, writeDemoState } from '@/lib/demo/store'

describe('demo store', () => {
  it('returns empty state when nothing is stored', () => {
    expect(readDemoState()).toEqual({
      accounts: {},
      sessionUserId: null,
      relationships: [],
      activeRelationshipIdByUser: {},
      habits: [],
      habitCategories: [],
      habitCompletions: [],
      rewardPunishmentCategories: [],
      rewards: [],
      punishments: [],
      catalogHistory: [],
      pointsLedger: [],
      rules: [],
      ruleCategories: [],
      ruleVersions: [],
      ruleAcknowledgments: [],
      journalEntries: [],
      journalPrompts: [],
    })
  })

  it('persists and reads state from localStorage', () => {
    writeDemoState({
      accounts: {},
      sessionUserId: 'user_1',
      relationships: [],
      activeRelationshipIdByUser: { user_1: null },
    })

    expect(readDemoState().sessionUserId).toBe('user_1')
    expect(readDemoState().activeRelationshipIdByUser.user_1).toBeNull()
  })

  it('updates state immutably via updater', () => {
    const next = updateDemoState((state) => ({
      ...state,
      sessionUserId: 'user_2',
    }))
    expect(next.sessionUserId).toBe('user_2')
    expect(readDemoState().sessionUserId).toBe('user_2')
  })

  it('falls back to empty state on corrupt JSON', () => {
    localStorage.setItem('subrosa.demo.v1', '{not-json')
    expect(readDemoState().sessionUserId).toBeNull()
  })
})
