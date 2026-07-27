import type {
  ExportedIdentityPrivateKey,
  ExportedIdentityPublicKey,
} from '@/lib/crypto/ecdh'
import { base64ToBytes, bytesToBase64 } from '@/lib/crypto/encoding'
import { exportRawKey, importContentKey } from '@/lib/crypto/keys'

const DB_NAME = 'subrosa-crypto-v1'
const DB_VERSION = 1
const IDENTITY_STORE = 'identityKeys'
const CONTENT_STORE = 'contentKeys'

type IdentityRecord = {
  userId: string
  publicKeyJwk: ExportedIdentityPublicKey
  privateKeyJwk: ExportedIdentityPrivateKey
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
        db.createObjectStore(IDENTITY_STORE, { keyPath: 'userId' })
      }
      if (!db.objectStoreNames.contains(CONTENT_STORE)) {
        db.createObjectStore(CONTENT_STORE, { keyPath: 'relationshipId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open crypto DB'))
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function saveIdentityKeyPair(
  userId: string,
  publicKeyJwk: ExportedIdentityPublicKey,
  privateKeyJwk: ExportedIdentityPrivateKey,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(IDENTITY_STORE, 'readwrite')
  await idbRequest(
    tx.objectStore(IDENTITY_STORE).put({
      userId,
      publicKeyJwk,
      privateKeyJwk,
    } satisfies IdentityRecord),
  )
  db.close()
}

export async function loadIdentityKeyPair(userId: string): Promise<IdentityRecord | null> {
  const db = await openDb()
  const tx = db.transaction(IDENTITY_STORE, 'readonly')
  const record = await idbRequest<IdentityRecord | undefined>(
    tx.objectStore(IDENTITY_STORE).get(userId),
  )
  db.close()
  return record ?? null
}

export async function saveUnlockedContentKey(
  relationshipId: string,
  contentKey: CryptoKey,
): Promise<void> {
  const raw = await exportRawKey(contentKey)
  const db = await openDb()
  const tx = db.transaction(CONTENT_STORE, 'readwrite')
  await idbRequest(
    tx.objectStore(CONTENT_STORE).put({
      relationshipId,
      rawKeyB64: bytesToBase64(raw),
    }),
  )
  db.close()
}

export async function loadUnlockedContentKey(
  relationshipId: string,
): Promise<CryptoKey | null> {
  const db = await openDb()
  const tx = db.transaction(CONTENT_STORE, 'readonly')
  const record = await idbRequest<{ relationshipId: string; rawKeyB64: string } | undefined>(
    tx.objectStore(CONTENT_STORE).get(relationshipId),
  )
  db.close()
  if (!record) return null
  return importContentKey(base64ToBytes(record.rawKeyB64))
}

export async function clearUnlockedContentKey(relationshipId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(CONTENT_STORE, 'readwrite')
  await idbRequest(tx.objectStore(CONTENT_STORE).delete(relationshipId))
  db.close()
}
