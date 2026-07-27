import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '@/lib/crypto/encoding'

export type CiphertextPayload = {
  ivB64: string
  ciphertextB64: string
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<CiphertextPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  return {
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(ciphertext),
  }
}

export async function decryptBytes(
  key: CryptoKey,
  payload: CiphertextPayload,
): Promise<Uint8Array> {
  const iv = base64ToBytes(payload.ivB64)
  const ciphertext = base64ToBytes(payload.ciphertextB64)
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext),
  )
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<CiphertextPayload> {
  return encryptBytes(key, utf8ToBytes(plaintext))
}

export async function decryptText(key: CryptoKey, payload: CiphertextPayload): Promise<string> {
  return bytesToUtf8(await decryptBytes(key, payload))
}
