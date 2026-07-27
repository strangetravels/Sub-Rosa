import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/app'
import {
  applyAutoPunishmentForHabitMiss,
  applyAutoRewardForHabitCompletion,
  removeAutoPunishmentForHabitMiss,
  removeAutoRewardForHabitCompletion,
} from '@/features/rewards/rewardService'
import {
  applyHabitCompletionPoints,
  removeHabitCompletionPoints,
} from '@/features/points/pointService'
import {
  notifyHabitCompleted,
  notifyHabitMissed,
} from '@/features/notifications/notificationService'
import { isDemoMode } from '@/lib/firebase/config'
import { createId } from '@/lib/id'
import { readDemoState, updateDemoState } from '@/lib/demo/store'
import { toLocalDateKey } from '@/lib/date'
import type {
  Habit,
  HabitCategory,
  HabitCompletion,
  HabitFrequency,
  HabitStatus,
} from '@/types/models'

const HABITS_CHANGED = 'subrosa-demo-habits'

export function notifyDemoHabitsChanged(): void {
  window.dispatchEvent(new Event(HABITS_CHANGED))
}

export function subscribeToDemoHabits(listener: () => void): () => void {
  window.addEventListener(HABITS_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(HABITS_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}

const DEFAULT_CATEGORIES: Array<{ label: string; color: string }> = [
  { label: 'Chores', color: '#78716c' },
  { label: 'Protocol', color: '#e11d48' },
  { label: 'Self-Care', color: '#0d9488' },
  { label: 'Discipline', color: '#a855f7' },
]

export async function ensureDefaultCategories(
  relationshipId: string,
): Promise<HabitCategory[]> {
  const existing = await listCategories(relationshipId)
  if (existing.length > 0) return existing

  const created: HabitCategory[] = DEFAULT_CATEGORIES.map((c) => ({
    id: createId('cat'),
    relationshipId,
    label: c.label,
    color: c.color,
  }))

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      habitCategories: [...state.habitCategories, ...created],
    }))
    notifyDemoHabitsChanged()
    return created
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await Promise.all(
    created.map((cat) =>
      setDoc(doc(db, 'relationships', relationshipId, 'habitCategories', cat.id), cat),
    ),
  )
  return created
}

export async function listCategories(relationshipId: string): Promise<HabitCategory[]> {
  if (isDemoMode()) {
    return readDemoState().habitCategories.filter((c) => c.relationshipId === relationshipId)
  }
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(
    collection(db, 'relationships', relationshipId, 'habitCategories'),
  )
  return snap.docs.map((d) => d.data() as HabitCategory)
}

export async function createCategory(input: {
  relationshipId: string
  label: string
  color: string
}): Promise<HabitCategory> {
  const label = input.label.trim()
  if (!label) throw new Error('Category name is required.')
  const color = input.color.trim() || '#78716c'

  const category: HabitCategory = {
    id: createId('cat'),
    relationshipId: input.relationshipId,
    label,
    color,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      habitCategories: [...state.habitCategories, category],
    }))
    notifyDemoHabitsChanged()
    return category
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'relationships', input.relationshipId, 'habitCategories', category.id),
    category,
  )
  return category
}

export async function listHabits(
  relationshipId: string,
  options?: { includeArchived?: boolean },
): Promise<Habit[]> {
  const includeArchived = options?.includeArchived ?? false
  if (isDemoMode()) {
    return readDemoState()
      .habits.filter((h) => h.relationshipId === relationshipId)
      .filter((h) => includeArchived || h.status === 'active')
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(collection(db, 'relationships', relationshipId, 'habits'))
  return snap.docs
    .map((d) => d.data() as Habit)
    .filter((h) => includeArchived || h.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function listCompletions(
  relationshipId: string,
  options?: { habitId?: string; since?: string },
): Promise<HabitCompletion[]> {
  if (isDemoMode()) {
    return readDemoState()
      .habitCompletions.filter((c) => c.relationshipId === relationshipId)
      .filter((c) => (options?.habitId ? c.habitId === options.habitId : true))
      .filter((c) => (options?.since ? c.completedOn >= options.since : true))
  }

  const db = getFirebaseDb()
  if (!db) return []
  let q = query(collection(db, 'relationships', relationshipId, 'habitCompletions'))
  if (options?.habitId) {
    q = query(q, where('habitId', '==', options.habitId))
  }
  if (options?.since) {
    q = query(q, where('completedOn', '>=', options.since))
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as HabitCompletion)
}

export type CreateHabitInput = {
  relationshipId: string
  title: string
  description?: string
  categoryId?: string | null
  frequency: HabitFrequency
  assignedToUserId: string
  createdByUserId: string
  linkedRewardId?: string | null
  linkedPunishmentId?: string | null
  pointValue?: number | null
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')

  const now = new Date().toISOString()
  const habit: Habit = {
    id: createId('hab'),
    relationshipId: input.relationshipId,
    title,
    description: (input.description ?? '').trim(),
    categoryId: input.categoryId ?? null,
    frequency: normalizeFrequency(input.frequency),
    assignedToUserId: input.assignedToUserId,
    createdByUserId: input.createdByUserId,
    linkedRewardId: input.linkedRewardId ?? null,
    linkedPunishmentId: input.linkedPunishmentId ?? null,
    pointValue:
      input.pointValue === undefined || input.pointValue === null
        ? null
        : Math.max(0, Math.floor(input.pointValue)),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  if (isDemoMode()) {
    updateDemoState((state) => ({
      ...state,
      habits: [...state.habits, habit],
    }))
    notifyDemoHabitsChanged()
    return habit
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(doc(db, 'relationships', habit.relationshipId, 'habits', habit.id), habit)
  return habit
}

export type UpdateHabitInput = {
  title?: string
  description?: string
  categoryId?: string | null
  frequency?: HabitFrequency
  assignedToUserId?: string
  linkedRewardId?: string | null
  linkedPunishmentId?: string | null
  pointValue?: number | null
  status?: HabitStatus
}

export async function updateHabit(
  relationshipId: string,
  habitId: string,
  patch: UpdateHabitInput,
): Promise<Habit> {
  if (isDemoMode()) {
    let updated: Habit | null = null
    updateDemoState((state) => {
      const habits = state.habits.map((h) => {
        if (h.id !== habitId || h.relationshipId !== relationshipId) return h
        updated = {
          ...h,
          title: patch.title !== undefined ? patch.title.trim() || h.title : h.title,
          description:
            patch.description !== undefined ? patch.description.trim() : h.description,
          categoryId: patch.categoryId !== undefined ? patch.categoryId : h.categoryId,
          frequency:
            patch.frequency !== undefined ? normalizeFrequency(patch.frequency) : h.frequency,
          assignedToUserId: patch.assignedToUserId ?? h.assignedToUserId,
          linkedRewardId:
            patch.linkedRewardId !== undefined ? patch.linkedRewardId : h.linkedRewardId,
          linkedPunishmentId:
            patch.linkedPunishmentId !== undefined
              ? patch.linkedPunishmentId
              : h.linkedPunishmentId,
          pointValue:
            patch.pointValue !== undefined
              ? patch.pointValue === null
                ? null
                : Math.max(0, Math.floor(patch.pointValue))
              : h.pointValue,
          status: patch.status ?? h.status,
          updatedAt: new Date().toISOString(),
        }
        return updated
      })
      return { ...state, habits }
    })
    notifyDemoHabitsChanged()
    if (!updated) throw new Error('Habit not found.')
    return updated
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const ref = doc(db, 'relationships', relationshipId, 'habits', habitId)
  const payload: {
    updatedAt: string
    title?: string
    description?: string
    categoryId?: string | null
    frequency?: HabitFrequency
    assignedToUserId?: string
    linkedRewardId?: string | null
    linkedPunishmentId?: string | null
    pointValue?: number | null
    status?: HabitStatus
  } = {
    updatedAt: new Date().toISOString(),
  }
  if (patch.title !== undefined) payload.title = patch.title.trim()
  if (patch.description !== undefined) payload.description = patch.description.trim()
  if (patch.categoryId !== undefined) payload.categoryId = patch.categoryId
  if (patch.frequency !== undefined) payload.frequency = normalizeFrequency(patch.frequency)
  if (patch.assignedToUserId !== undefined) payload.assignedToUserId = patch.assignedToUserId
  if (patch.linkedRewardId !== undefined) payload.linkedRewardId = patch.linkedRewardId
  if (patch.linkedPunishmentId !== undefined) {
    payload.linkedPunishmentId = patch.linkedPunishmentId
  }
  if (patch.pointValue !== undefined) {
    payload.pointValue =
      patch.pointValue === null ? null : Math.max(0, Math.floor(patch.pointValue))
  }
  if (patch.status !== undefined) payload.status = patch.status
  await updateDoc(ref, payload)

  const fresh = await getDoc(ref)
  if (!fresh.exists()) throw new Error('Habit not found.')
  return fresh.data() as Habit
}

export async function archiveHabit(
  relationshipId: string,
  habitId: string,
): Promise<Habit> {
  return updateHabit(relationshipId, habitId, { status: 'archived' })
}

export async function setHabitCompletedForDate(input: {
  relationshipId: string
  habitId: string
  userId: string
  completedOn?: string
  completed: boolean
}): Promise<HabitCompletion | null> {
  const completedOn = input.completedOn ?? toLocalDateKey()
  const habit = await getHabitById(input.relationshipId, input.habitId)

  if (isDemoMode()) {
    let result: HabitCompletion | null = null
    updateDemoState((state) => {
      const existing = state.habitCompletions.find(
        (c) => c.habitId === input.habitId && c.completedOn === completedOn,
      )
      if (input.completed) {
        if (existing) {
          result = existing
          return state
        }
        const completion: HabitCompletion = {
          id: createId('hcmp'),
          habitId: input.habitId,
          relationshipId: input.relationshipId,
          userId: input.userId,
          completedOn,
          createdAt: new Date().toISOString(),
        }
        result = completion
        return {
          ...state,
          habitCompletions: [...state.habitCompletions, completion],
        }
      }
      return {
        ...state,
        habitCompletions: state.habitCompletions.filter(
          (c) => !(c.habitId === input.habitId && c.completedOn === completedOn),
        ),
      }
    })
    notifyDemoHabitsChanged()
    if (input.completed && result) {
      await removeAutoPunishmentForHabitMiss({
        relationshipId: input.relationshipId,
        habitId: input.habitId,
        occurrenceKey: completedOn,
      })
      await applyAutoRewardForHabitCompletion({
        habit,
        completedOn,
        appliedByUserId: input.userId,
      })
      await applyHabitCompletionPoints({
        habit,
        completedOn,
        appliedByUserId: input.userId,
      })
      await notifyHabitCompleted({
        relationshipId: input.relationshipId,
        habit,
        actorUserId: input.userId,
      })
    } else if (!input.completed) {
      await removeAutoRewardForHabitCompletion({
        relationshipId: input.relationshipId,
        habitId: input.habitId,
        occurrenceKey: completedOn,
      })
      await removeHabitCompletionPoints({
        relationshipId: input.relationshipId,
        habitId: input.habitId,
        occurrenceKey: completedOn,
      })
    }
    return result
  }

  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const col = collection(db, 'relationships', input.relationshipId, 'habitCompletions')
  const existingSnap = await getDocs(
    query(col, where('habitId', '==', input.habitId), where('completedOn', '==', completedOn)),
  )

  if (input.completed) {
    if (!existingSnap.empty) return existingSnap.docs[0]!.data() as HabitCompletion
    const completion: HabitCompletion = {
      id: createId('hcmp'),
      habitId: input.habitId,
      relationshipId: input.relationshipId,
      userId: input.userId,
      completedOn,
      createdAt: new Date().toISOString(),
    }
    await setDoc(doc(col, completion.id), completion)
    await removeAutoPunishmentForHabitMiss({
      relationshipId: input.relationshipId,
      habitId: input.habitId,
      occurrenceKey: completedOn,
    })
    await applyAutoRewardForHabitCompletion({
      habit,
      completedOn,
      appliedByUserId: input.userId,
    })
    await applyHabitCompletionPoints({
      habit,
      completedOn,
      appliedByUserId: input.userId,
    })
    await notifyHabitCompleted({
      relationshipId: input.relationshipId,
      habit,
      actorUserId: input.userId,
    })
    return completion
  }

  await Promise.all(existingSnap.docs.map((d) => deleteDoc(d.ref)))
  await removeAutoRewardForHabitCompletion({
    relationshipId: input.relationshipId,
    habitId: input.habitId,
    occurrenceKey: completedOn,
  })
  await removeHabitCompletionPoints({
    relationshipId: input.relationshipId,
    habitId: input.habitId,
    occurrenceKey: completedOn,
  })
  return null
}

/** Log a miss for a due habit and apply its linked punishment (idempotent per date). */
export async function markHabitMissedForDate(input: {
  relationshipId: string
  habitId: string
  userId: string
  missedOn?: string
}): Promise<void> {
  const missedOn = input.missedOn ?? toLocalDateKey()
  const habit = await getHabitById(input.relationshipId, input.habitId)
  if (!habit.linkedPunishmentId) {
    throw new Error('This habit has no linked punishment.')
  }
  await applyAutoPunishmentForHabitMiss({
    habit,
    missedOn,
    appliedByUserId: input.userId,
  })
  await notifyHabitMissed({
    relationshipId: input.relationshipId,
    habit,
    actorUserId: input.userId,
  })
}

export async function clearHabitMissForDate(input: {
  relationshipId: string
  habitId: string
  missedOn?: string
}): Promise<void> {
  const missedOn = input.missedOn ?? toLocalDateKey()
  await removeAutoPunishmentForHabitMiss({
    relationshipId: input.relationshipId,
    habitId: input.habitId,
    occurrenceKey: missedOn,
  })
}

export async function getHabitById(
  relationshipId: string,
  habitId: string,
): Promise<Habit> {
  if (isDemoMode()) {
    const habit = readDemoState().habits.find(
      (h) => h.relationshipId === relationshipId && h.id === habitId,
    )
    if (!habit) throw new Error('Habit not found.')
    return habit
  }
  const db = getFirebaseDb()
  if (!db) throw new Error('Firestore is not configured.')
  const snap = await getDoc(doc(db, 'relationships', relationshipId, 'habits', habitId))
  if (!snap.exists()) throw new Error('Habit not found.')
  return snap.data() as Habit
}

function normalizeFrequency(frequency: HabitFrequency): HabitFrequency {
  if (frequency.type === 'daily') return { type: 'daily' }
  if (frequency.type === 'weeklyCount') {
    const count = Math.max(1, Math.min(7, Math.floor(frequency.count)))
    return { type: 'weeklyCount', count }
  }
  const days = [...new Set(frequency.days.filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  )
  if (days.length === 0) throw new Error('Pick at least one weekday.')
  return { type: 'weekdays', days }
}
