/** In-memory join passphrases for same-session sealed-key claims (not persisted). */
const pendingByRelationshipId = new Map<string, string>()

export function rememberPendingPassphrase(
  relationshipId: string,
  passphrase: string,
): void {
  pendingByRelationshipId.set(relationshipId, passphrase)
}

export function peekPendingPassphrase(relationshipId: string): string | undefined {
  return pendingByRelationshipId.get(relationshipId)
}

export function clearPendingPassphrase(relationshipId: string): void {
  pendingByRelationshipId.delete(relationshipId)
}

export function clearAllPendingPassphrases(): void {
  pendingByRelationshipId.clear()
}
