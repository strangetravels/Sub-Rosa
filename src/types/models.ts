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

export type Relationship = {
  id: string
  name: string
  status: RelationshipStatus
  members: RelationshipMember[]
  inviteCode: string
  createdAt: string
  createdBy: string
}
