/**
 * Client-side E2EE helpers (Web Crypto, key exchange, IndexedDB) land in feat/e2ee.
 * This module exists so the folder layout matches the scaffold plan.
 */

export async function isWebCryptoAvailable(): Promise<boolean> {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}
