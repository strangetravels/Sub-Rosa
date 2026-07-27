export { isWebCryptoAvailable, generateContentKey, wrapContentKey, unwrapContentKey } from '@/lib/crypto/keys'
export type { WrappedKeyPayload } from '@/lib/crypto/keys'
export { encryptText, decryptText, encryptBytes, decryptBytes } from '@/lib/crypto/aes'
export type { CiphertextPayload } from '@/lib/crypto/aes'
export {
  generateIdentityKeyPair,
  exportIdentityPublicKey,
  exportIdentityPrivateKey,
  importIdentityPublicKey,
  importIdentityPrivateKey,
  sealContentKeyForPeer,
  openContentKeyFromPeer,
  computeSafetyNumber,
} from '@/lib/crypto/ecdh'
export type { ExportedIdentityPublicKey, ExportedIdentityPrivateKey } from '@/lib/crypto/ecdh'
export {
  generateRecoveryPhrase,
  wrapContentKeyWithRecoveryPhrase,
  unwrapContentKeyWithRecoveryPhrase,
  normalizePhrase,
} from '@/lib/crypto/recovery'
export {
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  saveUnlockedContentKey,
  loadUnlockedContentKey,
  clearUnlockedContentKey,
} from '@/lib/crypto/store'
