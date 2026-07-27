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
