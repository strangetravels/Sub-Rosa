import { describe, expect, it } from 'vitest'
import { isWebCryptoAvailable } from '@/lib/crypto'

describe('isWebCryptoAvailable', () => {
  it('reports Web Crypto availability in jsdom', async () => {
    await expect(isWebCryptoAvailable()).resolves.toBe(true)
  })
})
