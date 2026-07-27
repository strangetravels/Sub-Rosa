import type {
  CatalogHistoryEntry,
  ChatMessage,
  Habit,
  HabitCategory,
  HabitCompletion,
  JournalEntry,
  JournalPrompt,
  PointsLedgerEntry,
  Punishment,
  Reward,
  RewardPunishmentCategory,
  Relationship,
  Rule,
  RuleAcknowledgment,
  RuleCategory,
  RuleVersion,
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
  rewardPunishmentCategories: RewardPunishmentCategory[]
  rewards: Reward[]
  punishments: Punishment[]
  catalogHistory: CatalogHistoryEntry[]
  pointsLedger: PointsLedgerEntry[]
  rules: Rule[]
  ruleCategories: RuleCategory[]
  ruleVersions: RuleVersion[]
  ruleAcknowledgments: RuleAcknowledgment[]
  journalEntries: JournalEntry[]
  journalPrompts: JournalPrompt[]
  chatMessages: ChatMessage[]
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
    chatMessages: [],
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
