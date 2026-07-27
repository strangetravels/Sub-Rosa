import { describe, expect, it } from 'vitest'
import { signUp } from '@/features/auth/authService'
import {
  bootstrapRelationshipCrypto,
  acceptRelationshipCrypto,
  unlockRelationshipContentKey,
  unlockWithRecoveryPhrase,
  getRelationshipSafetyNumber,
  getUnlockedContentKey,
  deliverContentKeyToPendingMembers,
  claimSealedContentKey,
  lockRelationshipContentKey,
  needsSealedKeyClaim,
} from '@/features/crypto/cryptoService'
import {
  createRelationship,
  joinRelationshipByInvite,
  updateRelationshipCrypto,
} from '@/features/relationships/relationshipService'
import { encryptText, decryptText } from '@/lib/crypto'
import { createId } from '@/lib/id'
import {
  clearPendingPassphrase,
  peekPendingPassphrase,
  rememberPendingPassphrase,
} from '@/features/crypto/pendingPassphrase'

const PASS = 'encrypt-me-please'

describe('cryptoService pairing', () => {
  it('bootstraps a relationship content key and unlocks it later', async () => {
    const user = await signUp('crypto-a@example.com', 'secret123', 'Crypto A')
    const relationshipId = createId('rel')
    const boot = await bootstrapRelationshipCrypto({
      relationshipId,
      user,
      passphrase: PASS,
    })

    expect(boot.recoveryPhrase.split(' ')).toHaveLength(12)
    expect(boot.crypto.wrappedContentKeys[user.id]).toBeTruthy()

    const unlocked = await unlockRelationshipContentKey({
      relationship: {
        id: relationshipId,
        name: 'Test',
        status: 'active',
        members: [{ userId: user.id, role: 'dominant', displayName: user.displayName }],
        inviteCode: 'ABCDEF',
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        crypto: boot.crypto,
      },
      userId: user.id,
      passphrase: PASS,
    })

    const sealed = await encryptText(unlocked, 'journal body')
    const again = await getUnlockedContentKey(relationshipId)
    expect(again).toBeTruthy()
    await expect(decryptText(again!, sealed)).resolves.toBe('journal body')
  })

  it('pairs two users and produces a matching safety number', async () => {
    const a = await signUp('pair-a@example.com', 'secret123', 'Pair A')
    const b = await signUp('pair-b@example.com', 'secret123', 'Pair B')
    const { relationship } = await createRelationship({
      user: a,
      name: 'Encrypted',
      role: 'dominant',
      passphrase: PASS,
    })
    const joined = await joinRelationshipByInvite({
      user: b,
      inviteCode: relationship.inviteCode,
      role: 'submissive',
      passphrase: `${PASS}-b`,
    })

    expect(joined.awaitingKeyDelivery).toBe(false)
    const number = await getRelationshipSafetyNumber(joined.relationship)
    expect(number?.replace(/\s/g, '')).toMatch(/^\d{30}$/)

    const accept = await acceptRelationshipCrypto({
      relationship: joined.relationship,
      user: b,
      passphrase: `${PASS}-b`,
    })
    expect(accept.safetyNumber).toBe(number)
  })

  it('restores access with a recovery phrase', async () => {
    const user = await signUp('recover@example.com', 'secret123', 'Recover')
    const { relationship, recoveryPhrase } = await createRelationship({
      user,
      name: 'Recoverable',
      role: 'switch',
      passphrase: PASS,
    })

    const restored = await unlockWithRecoveryPhrase({
      relationship,
      recoveryPhrase,
      newPassphrase: 'brand-new-passphrase',
      userId: user.id,
    })

    expect(restored.crypto.wrappedContentKeys[user.id]).toBeTruthy()
    const unlocked = await unlockRelationshipContentKey({
      relationship: { ...relationship, crypto: restored.crypto },
      userId: user.id,
      passphrase: 'brand-new-passphrase',
    })
    expect(unlocked).toBeTruthy()
  })

  it('delivers a sealed key for LDR then claims it on the joiner side', async () => {
    const a = await signUp('ldr-a@example.com', 'secret123', 'LDR A')
    const b = await signUp('ldr-b@example.com', 'secret123', 'LDR B')
    const { relationship } = await createRelationship({
      user: a,
      name: 'Long Distance',
      role: 'dominant',
      passphrase: PASS,
    })

    // Simulate a second device: joiner must not see the unlocked content key.
    await lockRelationshipContentKey(relationship.id)

    const joined = await joinRelationshipByInvite({
      user: b,
      inviteCode: relationship.inviteCode,
      role: 'submissive',
      passphrase: `${PASS}-b`,
    })
    expect(joined.awaitingKeyDelivery).toBe(true)
    expect(joined.relationship.crypto?.wrappedContentKeys[b.id]).toBeUndefined()

    rememberPendingPassphrase(joined.relationship.id, `${PASS}-b`)
    expect(peekPendingPassphrase(joined.relationship.id)).toBe(`${PASS}-b`)

    // Creator unlocks on their device and seals for the joiner.
    await unlockRelationshipContentKey({
      relationship: joined.relationship,
      userId: a.id,
      passphrase: PASS,
    })
    const sealedCrypto = await deliverContentKeyToPendingMembers({
      relationship: joined.relationship,
      senderUserId: a.id,
    })
    expect(sealedCrypto?.sealedContentKeys[b.id]).toBeTruthy()

    const withSeal = await updateRelationshipCrypto(joined.relationship.id, sealedCrypto!)
    expect(needsSealedKeyClaim(withSeal, b.id)).toBe(true)

    const claimed = await claimSealedContentKey({
      relationship: withSeal,
      userId: b.id,
      passphrase: `${PASS}-b`,
    })
    clearPendingPassphrase(withSeal.id)

    expect(claimed.wrappedContentKeys[b.id]).toBeTruthy()
    const joinerKey = await unlockRelationshipContentKey({
      relationship: { ...withSeal, crypto: claimed },
      userId: b.id,
      passphrase: `${PASS}-b`,
    })
    const payload = await encryptText(joinerKey, 'across devices')
    const creatorKey = await getUnlockedContentKey(withSeal.id)
    expect(creatorKey).toBeTruthy()
    await expect(decryptText(creatorKey!, payload)).resolves.toBe('across devices')
  })
})
