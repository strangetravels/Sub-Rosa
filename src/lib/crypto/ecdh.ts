import { base64ToBytes, bytesToBase64, utf8ToBytes } from '@/lib/crypto/encoding'
import { encryptBytes, decryptBytes, type CiphertextPayload } from '@/lib/crypto/aes'
import { exportRawKey, importContentKey } from '@/lib/crypto/keys'

export type IdentityKeyPair = {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export type ExportedIdentityPublicKey = JsonWebKey
export type ExportedIdentityPrivateKey = JsonWebKey

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  return { publicKey: pair.publicKey, privateKey: pair.privateKey }
}

export async function exportIdentityPublicKey(publicKey: CryptoKey): Promise<ExportedIdentityPublicKey> {
  return crypto.subtle.exportKey('jwk', publicKey)
}

export async function exportIdentityPrivateKey(
  privateKey: CryptoKey,
): Promise<ExportedIdentityPrivateKey> {
  return crypto.subtle.exportKey('jwk', privateKey)
}

export async function importIdentityPublicKey(
  jwk: ExportedIdentityPublicKey,
): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

export async function importIdentityPrivateKey(
  jwk: ExportedIdentityPrivateKey,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
}

async function deriveTransportKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  relationshipId: string,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  )
  const ikm = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: utf8ToBytes(`subrosa-ecdh-v1:${relationshipId}`),
      info: utf8ToBytes('content-key-transport'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealContentKeyForPeer(input: {
  contentKey: CryptoKey
  senderPrivateKey: CryptoKey
  recipientPublicKey: CryptoKey
  relationshipId: string
}): Promise<CiphertextPayload> {
  const transportKey = await deriveTransportKey(
    input.senderPrivateKey,
    input.recipientPublicKey,
    input.relationshipId,
  )
  const raw = await exportRawKey(input.contentKey)
  return encryptBytes(transportKey, raw)
}

export async function openContentKeyFromPeer(input: {
  sealed: CiphertextPayload
  recipientPrivateKey: CryptoKey
  senderPublicKey: CryptoKey
  relationshipId: string
}): Promise<CryptoKey> {
  const transportKey = await deriveTransportKey(
    input.recipientPrivateKey,
    input.senderPublicKey,
    input.relationshipId,
  )
  const raw = await decryptBytes(transportKey, input.sealed)
  return importContentKey(raw)
}

export function fingerprintPublicKey(jwk: ExportedIdentityPublicKey): string {
  const x = jwk.x ?? ''
  const y = jwk.y ?? ''
  return `${x}.${y}`
}

export async function computeSafetyNumber(
  publicKeyA: ExportedIdentityPublicKey,
  publicKeyB: ExportedIdentityPublicKey,
): Promise<string> {
  const left = fingerprintPublicKey(publicKeyA)
  const right = fingerprintPublicKey(publicKeyB)
  const [a, b] = left < right ? [left, right] : [right, left]
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', utf8ToBytes(`subrosa-safety-v1:${a}|${b}`)),
  )
  // 60-digit safety number in 12 groups of 5 (Signal-style readability)
  const digits = Array.from(digest.slice(0, 30), (byte) => (byte % 10).toString()).join('')
  return digits.replace(/(\d{5})(?=\d)/g, '$1 ').trim()
}

export function serializeSealedKey(payload: CiphertextPayload): string {
  return JSON.stringify(payload)
}

export function parseSealedKey(raw: string): CiphertextPayload {
  const parsed = JSON.parse(raw) as CiphertextPayload
  // Validate by round-tripping base64
  base64ToBytes(parsed.ivB64)
  base64ToBytes(parsed.ciphertextB64)
  return parsed
}

export function sealedKeyToStored(payload: CiphertextPayload): {
  ivB64: string
  ciphertextB64: string
} {
  return {
    ivB64: payload.ivB64,
    ciphertextB64: payload.ciphertextB64,
  }
}

export function sealedKeyFromStored(stored: {
  ivB64: string
  ciphertextB64: string
}): CiphertextPayload {
  return {
    ivB64: bytesToBase64(base64ToBytes(stored.ivB64)),
    ciphertextB64: bytesToBase64(base64ToBytes(stored.ciphertextB64)),
  }
}
