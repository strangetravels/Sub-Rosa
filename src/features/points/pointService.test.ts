import { describe, expect, it } from 'vitest'
import { createHabit, setHabitCompletedForDate } from '@/features/habits/habitService'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import { createReward } from '@/features/rewards/rewardService'
import {
  DEFAULT_HABIT_COMPLETION_POINTS,
  getPointsBalance,
  grantPoints,
  listPointsLedger,
  purchaseRewardWithPoints,
} from '@/features/points/pointService'

const PASS = 'encrypt-me-please'

describe('pointService', () => {
  it('grants points manually and tracks balance', async () => {
    const user = await signUp('points@example.com', 'secret123', 'Points User')
    const { relationship } = await createRelationship({
      user,
      name: 'Points Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })

    await grantPoints({
      relationshipId: relationship.id,
      userId: user.id,
      amount: 25,
      createdByUserId: user.id,
      note: 'Welcome bonus',
    })
    await grantPoints({
      relationshipId: relationship.id,
      userId: user.id,
      amount: -5,
      createdByUserId: user.id,
      note: 'Adjustment',
    })

    expect(await getPointsBalance(relationship.id, user.id)).toBe(20)
    const ledger = await listPointsLedger(relationship.id)
    expect(ledger).toHaveLength(2)
    expect(ledger[0]?.amount).toBe(-5)
  })

  it('awards default points on habit completion and removes on undo', async () => {
    const user = await signUp('habit-points@example.com', 'secret123', 'Habit Points')
    const { relationship } = await createRelationship({
      user,
      name: 'Habit Points Dynamic',
      role: 'submissive',
      passphrase: PASS,
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Kneel',
      frequency: { type: 'daily' },
      assignedToUserId: user.id,
      createdByUserId: user.id,
    })

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: true,
    })
    expect(await getPointsBalance(relationship.id, user.id)).toBe(DEFAULT_HABIT_COMPLETION_POINTS)

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: false,
    })
    expect(await getPointsBalance(relationship.id, user.id)).toBe(0)
  })

  it('spends points in the reward store and rejects insufficient balance', async () => {
    const user = await signUp('store-points@example.com', 'secret123', 'Store Points')
    const { relationship } = await createRelationship({
      user,
      name: 'Store Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })
    const reward = await createReward({
      relationshipId: relationship.id,
      title: 'Movie night',
      pointCost: 15,
      createdByUserId: user.id,
    })

    await expect(
      purchaseRewardWithPoints({
        relationshipId: relationship.id,
        rewardId: reward.id,
        buyerUserId: user.id,
      }),
    ).rejects.toThrow(/Not enough points/)

    await grantPoints({
      relationshipId: relationship.id,
      userId: user.id,
      amount: 20,
      createdByUserId: user.id,
    })

    await purchaseRewardWithPoints({
      relationshipId: relationship.id,
      rewardId: reward.id,
      buyerUserId: user.id,
      note: 'Friday treat',
    })

    expect(await getPointsBalance(relationship.id, user.id)).toBe(5)
    const ledger = await listPointsLedger(relationship.id, { userId: user.id })
    expect(ledger.some((e) => e.source === 'reward_purchase' && e.amount === -15)).toBe(true)
  })

  it('uses custom habit pointValue', async () => {
    const user = await signUp('custom-points@example.com', 'secret123', 'Custom Points')
    const { relationship } = await createRelationship({
      user,
      name: 'Custom Dynamic',
      role: 'switch',
      passphrase: PASS,
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Big task',
      frequency: { type: 'daily' },
      assignedToUserId: user.id,
      createdByUserId: user.id,
      pointValue: 42,
    })

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: true,
    })
    expect(await getPointsBalance(relationship.id, user.id)).toBe(42)
  })
})
