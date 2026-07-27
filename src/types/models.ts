export type RelationshipRole = 'dominant' | 'submissive' | 'switch'

export type RelationshipStatus = 'active' | 'paused' | 'archived'

export type UserProfile = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export type RelationshipMember = {
  userId: string
  role: RelationshipRole
  displayName: string
}

export type WrappedKeyRecord = {
  kdf: 'argon2id'
  saltB64: string
  ivB64: string
  ciphertextB64: string
}

export type EncryptedTextRecord = {
  ivB64: string
  ciphertextB64: string
}

export type SealedKeyRecord = {
  ivB64: string
  ciphertextB64: string
  senderUserId: string
}

export type RelationshipCrypto = {
  /** ECDH P-256 public keys per member (JWK). */
  identityPublicKeys: Record<string, JsonWebKey>
  /** Content key wrapped under each member's encryption passphrase. */
  wrappedContentKeys: Record<string, WrappedKeyRecord>
  /** Optional recovery wrap created by the relationship creator. */
  recoveryWrap?: WrappedKeyRecord
  /**
   * One-time ECDH-sealed content key deliveries, keyed by recipient user id.
   * Written by a member who already holds the content key once the recipient
   * has published their identity public key.
   */
  sealedContentKeys: Record<string, SealedKeyRecord>
}

export type Relationship = {
  id: string
  name: string
  status: RelationshipStatus
  members: RelationshipMember[]
  inviteCode: string
  createdAt: string
  createdBy: string
  crypto?: RelationshipCrypto
}

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'weeklyCount'; count: number }

export type HabitStatus = 'active' | 'archived'

export type HabitCategory = {
  id: string
  relationshipId: string
  label: string
  color: string
}

export type Habit = {
  id: string
  relationshipId: string
  title: string
  description: string
  categoryId: string | null
  frequency: HabitFrequency
  assignedToUserId: string
  createdByUserId: string
  linkedRewardId?: string | null
  linkedPunishmentId?: string | null
  /** Points granted on completion (defaults to 10 when unset). */
  pointValue?: number | null
  status: HabitStatus
  createdAt: string
  updatedAt: string
}

export type HabitCompletion = {
  id: string
  habitId: string
  relationshipId: string
  userId: string
  /** Local calendar date YYYY-MM-DD */
  completedOn: string
  createdAt: string
}

export type RuleStatus = 'active' | 'archived'

export type RuleCategory = {
  id: string
  relationshipId: string
  label: string
  color: string
}

export type Rule = {
  id: string
  relationshipId: string
  title: string
  body: string
  bodyCiphertext?: EncryptedTextRecord
  categoryId: string | null
  requiresAcknowledgment: boolean
  /** Reserved for punishments feature branch. */
  linkedPunishmentId?: string | null
  currentVersion: number
  status: RuleStatus
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type RuleVersion = {
  id: string
  ruleId: string
  relationshipId: string
  version: number
  title: string
  body: string
  bodyCiphertext?: EncryptedTextRecord
  categoryId: string | null
  requiresAcknowledgment: boolean
  linkedPunishmentId?: string | null
  editedByUserId: string
  editedAt: string
  changeNote?: string
}

export type RuleAcknowledgment = {
  id: string
  ruleId: string
  relationshipId: string
  userId: string
  version: number
  acknowledgedAt: string
}

export type CatalogStatus = 'active' | 'archived'

export type RewardPunishmentCategory = {
  id: string
  relationshipId: string
  label: string
  color: string
}

export type Reward = {
  id: string
  relationshipId: string
  title: string
  description: string
  descriptionCiphertext?: EncryptedTextRecord
  categoryId: string | null
  pointCost: number
  status: CatalogStatus
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type Punishment = {
  id: string
  relationshipId: string
  title: string
  description: string
  descriptionCiphertext?: EncryptedTextRecord
  categoryId: string | null
  severity: 1 | 2 | 3 | 4 | 5
  status: CatalogStatus
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type ApplicationSource =
  | 'manual_reward'
  | 'manual_punishment'
  | 'habit_completion'
  | 'habit_punishment'
  | 'rule_violation'
  | 'reward_purchase'

export type CatalogHistoryEntry = {
  id: string
  relationshipId: string
  itemType: 'reward' | 'punishment'
  itemId: string
  itemTitle: string
  source: ApplicationSource
  targetUserId: string
  appliedByUserId: string
  appliedAt: string
  note: string
  noteCiphertext?: EncryptedTextRecord
  habitId?: string
  ruleId?: string
  occurrenceKey?: string
}

export type JournalEntryVisibility = 'private' | 'shared'

export type JournalEntry = {
  id: string
  relationshipId: string
  authorUserId: string
  visibility: JournalEntryVisibility
  title: string
  body: string
  bodyCiphertext?: EncryptedTextRecord
  tags: string[]
  promptId?: string | null
  assignedByUserId?: string | null
  createdAt: string
  updatedAt: string
}

export type JournalPrompt = {
  id: string
  relationshipId: string
  text: string
  category: string
  createdByUserId: string
  createdAt: string
}

export type PointsLedgerSource =
  | 'habit_completion'
  | 'manual_grant'
  | 'manual_adjust'
  | 'reward_purchase'

export type PointsLedgerEntry = {
  id: string
  relationshipId: string
  userId: string
  amount: number
  source: PointsLedgerSource
  note: string
  noteCiphertext?: EncryptedTextRecord
  createdAt: string
  createdByUserId: string
  habitId?: string
  rewardId?: string
  occurrenceKey?: string
  catalogHistoryId?: string
}
