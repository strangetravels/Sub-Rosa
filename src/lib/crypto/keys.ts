import { argon2id } from '@noble/hashes/argon2.js'
import { bytesToBase64, base64ToBytes, utf8ToBytes } from '@/lib/crypto/encoding'

/** Production defaults; tests use a lighter profile so the suite stays fast. */
const ARGON2_OPTS =
  import.meta.env.MODE === 'test'
    ? { t: 1, m: 16, p: 1, dkLen: 32 }
    : { t: 3, m: 64 * 1024, p: 1, dkLen: 32 }
export type WrappedKeyPayload = {
  kdf: 'argon2id'
  saltB64: string
  ivB64: string
  ciphertextB64: string
}

export async function isWebCryptoAvailable(): Promise<boolean> {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

export async function generateContentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

export async function importContentKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function deriveWrappingKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const raw = argon2id(utf8ToBytes(passphrase), salt, ARGON2_OPTS)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function wrapContentKey(
  contentKey: CryptoKey,
  passphrase: string,
): Promise<WrappedKeyPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrappingKey = await deriveWrappingKeyFromPassphrase(passphrase, salt)
  const raw = await exportRawKey(contentKey)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw),
  )
  return {
    kdf: 'argon2id',
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(ciphertext),
  }
}

export async function unwrapContentKey(
  payload: WrappedKeyPayload,
  passphrase: string,
): Promise<CryptoKey> {
  const salt = base64ToBytes(payload.saltB64)
  const iv = base64ToBytes(payload.ivB64)
  const ciphertext = base64ToBytes(payload.ciphertextB64)
  const wrappingKey = await deriveWrappingKeyFromPassphrase(passphrase, salt)
  try {
    const raw = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext),
    )
    return importContentKey(raw)
  } catch {
    throw new Error('Incorrect passphrase.')
  }
}
