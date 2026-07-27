import { describe, expect, it } from 'vitest'
import { createHabit, setHabitCompletedForDate } from '@/features/habits/habitService'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  applyPunishmentManually,
  applyRewardManually,
  createPunishment,
  createReward,
  ensureDefaultRewardPunishmentCategories,
  listCatalogHistory,
  listPunishments,
  listRewards,
} from '@/features/rewards/rewardService'

const PASS = 'encrypt-me-please'

describe('rewardService', () => {
  it('creates catalogs and logs manual applications', async () => {
    const user = await signUp('rewards@example.com', 'secret123', 'Rewards User')
    const { relationship } = await createRelationship({
      user,
      name: 'Rewards Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })

    const categories = await ensureDefaultRewardPunishmentCategories(relationship.id)
    expect(categories.length).toBeGreaterThan(0)

    const reward = await createReward({
      relationshipId: relationship.id,
      title: 'Extra screen time',
      description: '30 extra minutes',
      categoryId: categories[0]?.id,
      pointCost: 10,
      createdByUserId: user.id,
    })
    const punishment = await createPunishment({
      relationshipId: relationship.id,
      title: 'Write apology',
      description: 'One handwritten page',
      categoryId: categories[1]?.id,
      severity: 2,
      createdByUserId: user.id,
    })

    expect((await listRewards(relationship.id)).map((r) => r.id)).toContain(reward.id)
    expect((await listPunishments(relationship.id)).map((p) => p.id)).toContain(punishment.id)

    await applyRewardManually({
      relationshipId: relationship.id,
      rewardId: reward.id,
      targetUserId: user.id,
      appliedByUserId: user.id,
      note: 'Nice work',
    })
    await applyPunishmentManually({
      relationshipId: relationship.id,
      punishmentId: punishment.id,
      targetUserId: user.id,
      appliedByUserId: user.id,
      note: 'Missed protocol',
    })

    const history = await listCatalogHistory(relationship.id)
    expect(history).toHaveLength(2)
    expect(history[0]?.itemType).toBe('punishment')
    expect(history[1]?.itemType).toBe('reward')
  })

  it('auto-applies linked rewards on habit completion', async () => {
    const user = await signUp('auto-reward@example.com', 'secret123', 'Auto Reward')
    const { relationship } = await createRelationship({
      user,
      name: 'Auto Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })
    const reward = await createReward({
      relationshipId: relationship.id,
      title: 'Gold star',
      createdByUserId: user.id,
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Morning protocol',
      frequency: { type: 'daily' },
      assignedToUserId: user.id,
      createdByUserId: user.id,
      linkedRewardId: reward.id,
    })

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: true,
    })

    let history = await listCatalogHistory(relationship.id)
    expect(history).toHaveLength(1)
    expect(history[0]?.source).toBe('habit_completion')

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: false,
    })

    history = await listCatalogHistory(relationship.id)
    expect(history).toHaveLength(0)
  })
})
