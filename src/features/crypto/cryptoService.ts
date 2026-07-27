import {
  clearUnlockedContentKey,
  computeSafetyNumber,
  exportIdentityPrivateKey,
  exportIdentityPublicKey,
  generateContentKey,
  generateIdentityKeyPair,
  generateRecoveryPhrase,
  importIdentityPrivateKey,
  importIdentityPublicKey,
  loadIdentityKeyPair,
  loadUnlockedContentKey,
  openContentKeyFromPeer,
  saveIdentityKeyPair,
  saveUnlockedContentKey,
  sealContentKeyForPeer,
  unwrapContentKey,
  unwrapContentKeyWithRecoveryPhrase,
  wrapContentKey,
  wrapContentKeyWithRecoveryPhrase,
  type ExportedIdentityPublicKey,
  type WrappedKeyPayload,
} from '@/lib/crypto'
import type { Relationship, RelationshipCrypto, UserProfile } from '@/types/models'

export type SecureCreateResult = {
  crypto: RelationshipCrypto
  recoveryPhrase: string
}

export type SecureJoinResult = {
  crypto: RelationshipCrypto
  safetyNumber: string
  awaitingKeyDelivery: boolean
}

async function ensureIdentity(userId: string): Promise<{
  publicKeyJwk: ExportedIdentityPublicKey
  privateKey: CryptoKey
}> {
  const existing = await loadIdentityKeyPair(userId)
  if (existing) {
    return {
      publicKeyJwk: existing.publicKeyJwk,
      privateKey: await importIdentityPrivateKey(existing.privateKeyJwk),
    }
  }

  const pair = await generateIdentityKeyPair()
  const publicKeyJwk = await exportIdentityPublicKey(pair.publicKey)
  const privateKeyJwk = await exportIdentityPrivateKey(pair.privateKey)
  await saveIdentityKeyPair(userId, publicKeyJwk, privateKeyJwk)
  return { publicKeyJwk, privateKey: pair.privateKey }
}

function cloneCrypto(source?: RelationshipCrypto): RelationshipCrypto {
  return {
    identityPublicKeys: { ...(source?.identityPublicKeys ?? {}) },
    wrappedContentKeys: { ...(source?.wrappedContentKeys ?? {}) },
    sealedContentKeys: { ...(source?.sealedContentKeys ?? {}) },
    recoveryWrap: source?.recoveryWrap,
  }
}

export async function bootstrapRelationshipCrypto(input: {
  relationshipId: string
  user: UserProfile
  passphrase: string
}): Promise<SecureCreateResult> {
  if (input.passphrase.trim().length < 8) {
    throw new Error('Encryption passphrase must be at least 8 characters.')
  }

  const contentKey = await generateContentKey()
  const identity = await ensureIdentity(input.user.id)
  const wrapped = await wrapContentKey(contentKey, input.passphrase)
  const recoveryPhrase = generateRecoveryPhrase()
  const recoveryWrap = await wrapContentKeyWithRecoveryPhrase(contentKey, recoveryPhrase)

  await saveUnlockedContentKey(input.relationshipId, contentKey)

  return {
    crypto: {
      identityPublicKeys: {
        [input.user.id]: identity.publicKeyJwk,
      },
      wrappedContentKeys: {
        [input.user.id]: wrapped,
      },
      recoveryWrap,
      sealedContentKeys: {},
    },
    recoveryPhrase,
  }
}

export async function acceptRelationshipCrypto(input: {
  relationship: Relationship
  user: UserProfile
  passphrase: string
}): Promise<SecureJoinResult> {
  if (input.passphrase.trim().length < 8) {
    throw new Error('Encryption passphrase must be at least 8 characters.')
  }

  const cryptoState = cloneCrypto(input.relationship.crypto)
  const identity = await ensureIdentity(input.user.id)
  cryptoState.identityPublicKeys[input.user.id] = identity.publicKeyJwk

  const creatorId = input.relationship.createdBy
  const creatorPublic = cryptoState.identityPublicKeys[creatorId]
  if (!creatorPublic) {
    throw new Error('Creator has not published an identity key yet.')
  }

  let contentKey: CryptoKey | null = null

  // 1) Sealed delivery left by someone who already holds the content key
  const sealed = cryptoState.sealedContentKeys[input.user.id]
  if (sealed) {
    const senderPublic = cryptoState.identityPublicKeys[sealed.senderUserId]
    if (!senderPublic) {
      throw new Error('Missing sender identity key for sealed content key.')
    }
    contentKey = await openContentKeyFromPeer({
      sealed,
      recipientPrivateKey: identity.privateKey,
      senderPublicKey: await importIdentityPublicKey(senderPublic),
      relationshipId: input.relationship.id,
    })
  }

  // 2) Same-device / already-unlocked content key (demo & multi-tab convenience)
  if (!contentKey) {
    contentKey = await loadUnlockedContentKey(input.relationship.id)
  }

  // 3) If the creator's identity private key is on this device, seal + wrap now
  if (contentKey) {
    const creatorIdentity = await loadIdentityKeyPair(creatorId)
    if (creatorIdentity) {
      const sealed = await sealContentKeyForPeer({
        contentKey,
        senderPrivateKey: await importIdentityPrivateKey(creatorIdentity.privateKeyJwk),
        recipientPublicKey: await importIdentityPublicKey(identity.publicKeyJwk),
        relationshipId: input.relationship.id,
      })
      cryptoState.sealedContentKeys[input.user.id] = {
        ...sealed,
        senderUserId: creatorId,
      }
    }

    cryptoState.wrappedContentKeys[input.user.id] = await wrapContentKey(
      contentKey,
      input.passphrase,
    )
    await saveUnlockedContentKey(input.relationship.id, contentKey)
  }

  const safetyNumber = await computeSafetyNumber(creatorPublic, identity.publicKeyJwk)

  return {
    crypto: cryptoState,
    safetyNumber,
    awaitingKeyDelivery: !cryptoState.wrappedContentKeys[input.user.id],
  }
}

export async function deliverContentKeyToPendingMembers(input: {
  relationship: Relationship
  senderUserId: string
}): Promise<RelationshipCrypto | null> {
  const cryptoState = input.relationship.crypto
  if (!cryptoState) return null

  const contentKey = await loadUnlockedContentKey(input.relationship.id)
  if (!contentKey) return null

  const senderIdentity = await loadIdentityKeyPair(input.senderUserId)
  if (!senderIdentity) return null

  const next = cloneCrypto(cryptoState)
  let changed = false

  for (const member of input.relationship.members) {
    if (member.userId === input.senderUserId) continue
    const recipientPublic = next.identityPublicKeys[member.userId]
    if (!recipientPublic) continue
    if (next.wrappedContentKeys[member.userId] || next.sealedContentKeys[member.userId]) {
      continue
    }

    next.sealedContentKeys[member.userId] = {
      ...(await sealContentKeyForPeer({
        contentKey,
        senderPrivateKey: await importIdentityPrivateKey(senderIdentity.privateKeyJwk),
        recipientPublicKey: await importIdentityPublicKey(recipientPublic),
        relationshipId: input.relationship.id,
      })),
      senderUserId: input.senderUserId,
    }
    changed = true
  }

  return changed ? next : null
}

export async function claimSealedContentKey(input: {
  relationship: Relationship
  userId: string
  passphrase: string
}): Promise<RelationshipCrypto> {
  const cryptoState = cloneCrypto(input.relationship.crypto)
  const sealed = cryptoState.sealedContentKeys[input.userId]
  if (!sealed) {
    throw new Error('No sealed content key is available yet.')
  }
  const senderPublic = cryptoState.identityPublicKeys[sealed.senderUserId]
  if (!senderPublic) {
    throw new Error('Missing sender identity key for sealed content key.')
  }

  const identity = await ensureIdentity(input.userId)
  const contentKey = await openContentKeyFromPeer({
    sealed,
    recipientPrivateKey: identity.privateKey,
    senderPublicKey: await importIdentityPublicKey(senderPublic),
    relationshipId: input.relationship.id,
  })
  cryptoState.wrappedContentKeys[input.userId] = await wrapContentKey(contentKey, input.passphrase)
  await saveUnlockedContentKey(input.relationship.id, contentKey)
  return cryptoState
}

export async function unlockRelationshipContentKey(input: {
  relationship: Relationship
  userId: string
  passphrase: string
}): Promise<CryptoKey> {
  const wrap = input.relationship.crypto?.wrappedContentKeys[input.userId]
  if (!wrap) {
    throw new Error('No wrapped content key for this account yet. Finish secure pairing first.')
  }
  const contentKey = await unwrapContentKey(wrap, input.passphrase)
  await saveUnlockedContentKey(input.relationship.id, contentKey)
  return contentKey
}

export async function unlockWithRecoveryPhrase(input: {
  relationship: Relationship
  recoveryPhrase: string
  newPassphrase: string
  userId: string
}): Promise<{ contentKey: CryptoKey; wrap: WrappedKeyPayload; crypto: RelationshipCrypto }> {
  const recoveryWrap = input.relationship.crypto?.recoveryWrap
  if (!recoveryWrap) {
    throw new Error('No recovery phrase was saved for this relationship.')
  }
  if (input.newPassphrase.trim().length < 8) {
    throw new Error('Encryption passphrase must be at least 8 characters.')
  }
  const contentKey = await unwrapContentKeyWithRecoveryPhrase(
    recoveryWrap,
    input.recoveryPhrase,
  )
  const wrap = await wrapContentKey(contentKey, input.newPassphrase)
  await saveUnlockedContentKey(input.relationship.id, contentKey)
  const crypto = cloneCrypto(input.relationship.crypto)
  crypto.wrappedContentKeys[input.userId] = wrap
  return { contentKey, wrap, crypto }
}

export async function getRelationshipSafetyNumber(
  relationship: Relationship,
): Promise<string | null> {
  const keys = Object.values(relationship.crypto?.identityPublicKeys ?? {})
  if (keys.length < 2) return null
  return computeSafetyNumber(keys[0]!, keys[1]!)
}

export async function lockRelationshipContentKey(relationshipId: string): Promise<void> {
  await clearUnlockedContentKey(relationshipId)
}

export async function getUnlockedContentKey(relationshipId: string): Promise<CryptoKey | null> {
  return loadUnlockedContentKey(relationshipId)
}

export function needsSealedKeyClaim(
  relationship: Relationship,
  userId: string,
): boolean {
  const crypto = relationship.crypto
  if (!crypto) return false
  return Boolean(crypto.sealedContentKeys[userId] && !crypto.wrappedContentKeys[userId])
}
