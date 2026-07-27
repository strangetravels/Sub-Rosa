import { describe, expect, it } from 'vitest'
import {
  createHabit,
  markHabitMissedForDate,
  setHabitCompletedForDate,
} from '@/features/habits/habitService'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'
import {
  applyPunishmentManually,
  applyRewardManually,
  archivePunishment,
  archiveReward,
  createPunishment,
  createReward,
  ensureDefaultRewardPunishmentCategories,
  listCatalogHistory,
  listPunishments,
  listRewards,
  restorePunishment,
  restoreReward,
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

  it('auto-applies linked punishments on habit miss and clears on completion', async () => {
    const user = await signUp('auto-punish@example.com', 'secret123', 'Auto Punish')
    const { relationship } = await createRelationship({
      user,
      name: 'Punish Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })
    const punishment = await createPunishment({
      relationshipId: relationship.id,
      title: 'Extra chores',
      severity: 2,
      createdByUserId: user.id,
    })
    const habit = await createHabit({
      relationshipId: relationship.id,
      title: 'Evening check-in',
      frequency: { type: 'daily' },
      assignedToUserId: user.id,
      createdByUserId: user.id,
      linkedPunishmentId: punishment.id,
    })

    await markHabitMissedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      missedOn: '2026-07-27',
    })

    let history = await listCatalogHistory(relationship.id)
    expect(history).toHaveLength(1)
    expect(history[0]?.source).toBe('habit_punishment')
    expect(history[0]?.itemId).toBe(punishment.id)

    await markHabitMissedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      missedOn: '2026-07-27',
    })
    history = await listCatalogHistory(relationship.id)
    expect(history).toHaveLength(1)

    await setHabitCompletedForDate({
      relationshipId: relationship.id,
      habitId: habit.id,
      userId: user.id,
      completedOn: '2026-07-27',
      completed: true,
    })
    history = await listCatalogHistory(relationship.id)
    expect(history.some((h) => h.source === 'habit_punishment')).toBe(false)
  })

  it('archives and restores catalog items', async () => {
    const user = await signUp('archive-rp@example.com', 'secret123', 'Archive RP')
    const { relationship } = await createRelationship({
      user,
      name: 'Archive Dynamic',
      role: 'dominant',
      passphrase: PASS,
    })
    const reward = await createReward({
      relationshipId: relationship.id,
      title: 'Movie night',
      createdByUserId: user.id,
    })
    const punishment = await createPunishment({
      relationshipId: relationship.id,
      title: 'Early bedtime',
      createdByUserId: user.id,
    })

    const archivedReward = await archiveReward(relationship.id, reward.id)
    const archivedPunishment = await archivePunishment(relationship.id, punishment.id)
    expect(archivedReward.status).toBe('archived')
    expect(archivedPunishment.status).toBe('archived')
    expect(await listRewards(relationship.id)).toHaveLength(0)
    expect(await listPunishments(relationship.id)).toHaveLength(0)
    expect(await listRewards(relationship.id, { includeArchived: true })).toHaveLength(1)
    expect(await listPunishments(relationship.id, { includeArchived: true })).toHaveLength(1)

    expect((await restoreReward(relationship.id, reward.id)).status).toBe('active')
    expect((await restorePunishment(relationship.id, punishment.id)).status).toBe('active')
    expect(await listRewards(relationship.id)).toHaveLength(1)
    expect(await listPunishments(relationship.id)).toHaveLength(1)
  })
})
