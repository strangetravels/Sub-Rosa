import { describe, expect, it } from 'vitest'
import {
  decryptText,
  encryptText,
  generateContentKey,
  generateIdentityKeyPair,
  exportIdentityPublicKey,
  exportIdentityPrivateKey,
  importIdentityPrivateKey,
  importIdentityPublicKey,
  sealContentKeyForPeer,
  openContentKeyFromPeer,
  computeSafetyNumber,
  wrapContentKey,
  unwrapContentKey,
  generateRecoveryPhrase,
  wrapContentKeyWithRecoveryPhrase,
  unwrapContentKeyWithRecoveryPhrase,
  isWebCryptoAvailable,
} from '@/lib/crypto'

describe('crypto primitives', () => {
  it('reports Web Crypto availability', async () => {
    await expect(isWebCryptoAvailable()).resolves.toBe(true)
  })

  it('round-trips AES-GCM text with a content key', async () => {
    const key = await generateContentKey()
    const sealed = await encryptText(key, 'private journal entry')
    await expect(decryptText(key, sealed)).resolves.toBe('private journal entry')
  })

  it('wraps and unwraps a content key with a passphrase', async () => {
    const key = await generateContentKey()
    const wrapped = await wrapContentKey(key, 'correct horse battery')
    const unwrapped = await unwrapContentKey(wrapped, 'correct horse battery')
    const sealed = await encryptText(key, 'hello')
    await expect(decryptText(unwrapped, sealed)).resolves.toBe('hello')
  })

  it('rejects a wrong passphrase', async () => {
    const key = await generateContentKey()
    const wrapped = await wrapContentKey(key, 'correct horse battery')
    await expect(unwrapContentKey(wrapped, 'wrong passphrase!!')).rejects.toThrow(
      'Incorrect passphrase.',
    )
  })

  it('transports a content key over ECDH', async () => {
    const relationshipId = 'rel_test'
    const alice = await generateIdentityKeyPair()
    const bob = await generateIdentityKeyPair()
    const contentKey = await generateContentKey()

    const sealed = await sealContentKeyForPeer({
      contentKey,
      senderPrivateKey: alice.privateKey,
      recipientPublicKey: bob.publicKey,
      relationshipId,
    })

    const opened = await openContentKeyFromPeer({
      sealed,
      recipientPrivateKey: bob.privateKey,
      senderPublicKey: alice.publicKey,
      relationshipId,
    })

    const payload = await encryptText(contentKey, 'shared secret note')
    await expect(decryptText(opened, payload)).resolves.toBe('shared secret note')
  })

  it('computes a stable safety number regardless of key order', async () => {
    const a = await generateIdentityKeyPair()
    const b = await generateIdentityKeyPair()
    const aPub = await exportIdentityPublicKey(a.publicKey)
    const bPub = await exportIdentityPublicKey(b.publicKey)
    const left = await computeSafetyNumber(aPub, bPub)
    const right = await computeSafetyNumber(bPub, aPub)
    expect(left).toBe(right)
    expect(left.replace(/\s/g, '')).toMatch(/^\d{30}$/)
  })

  it('exports and reimports identity keys', async () => {
    const pair = await generateIdentityKeyPair()
    const pub = await exportIdentityPublicKey(pair.publicKey)
    const priv = await exportIdentityPrivateKey(pair.privateKey)
    await expect(importIdentityPublicKey(pub)).resolves.toBeTruthy()
    await expect(importIdentityPrivateKey(priv)).resolves.toBeTruthy()
  })

  it('recovers a content key from a recovery phrase', async () => {
    const key = await generateContentKey()
    const phrase = generateRecoveryPhrase()
    expect(phrase.split(' ')).toHaveLength(12)
    const wrapped = await wrapContentKeyWithRecoveryPhrase(key, phrase)
    const recovered = await unwrapContentKeyWithRecoveryPhrase(wrapped, phrase)
    const sealed = await encryptText(key, 'recover me')
    await expect(decryptText(recovered, sealed)).resolves.toBe('recover me')
  })
})
