import type {
  Habit,
  HabitCategory,
  HabitCompletion,
  Relationship,
  UserProfile,
} from '@/types/models'

const STORAGE_KEY = 'subrosa.demo.v1'

type DemoAccount = {
  password: string
  profile: UserProfile
}

export type DemoState = {
  accounts: Record<string, DemoAccount>
  sessionUserId: string | null
  relationships: Relationship[]
  activeRelationshipIdByUser: Record<string, string | null>
  habits: Habit[]
  habitCategories: HabitCategory[]
  habitCompletions: HabitCompletion[]
}

function emptyState(): DemoState {
  return {
    accounts: {},
    sessionUserId: null,
    relationships: [],
    activeRelationshipIdByUser: {},
    habits: [],
    habitCategories: [],
    habitCompletions: [],
  }
}

export function readDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return { ...emptyState(), ...(JSON.parse(raw) as DemoState) }
  } catch {
    return emptyState()
  }
}

export function writeDemoState(state: DemoState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function updateDemoState(updater: (state: DemoState) => DemoState): DemoState {
  const next = updater(readDemoState())
  writeDemoState(next)
  return next
}
