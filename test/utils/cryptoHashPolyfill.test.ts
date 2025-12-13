import {describe, it, expect} from 'vitest'
import {ensureCryptoHash} from './cryptoHashPolyfill'
import {createHash} from 'node:crypto'

describe('ensureCryptoHash', () => {
  it('adds crypto.hash when missing', async () => {
    // Remove if present to simulate Node 18
    const original = (crypto as any).hash
    const originalNode = (await import('node:crypto')) as any
    ;(crypto as any).hash = undefined

    ensureCryptoHash()

    const result = (crypto as any).hash('sha256', 'hello')
    const expected = createHash('sha256').update('hello').digest('hex')

    expect(result).toBe(expected)
    expect((await import('node:crypto') as any).hash('sha256', 'hello')).toBe(expected)

    // restore
    ;(crypto as any).hash = original
  })
})
