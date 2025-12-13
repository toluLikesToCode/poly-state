import {describe, it, expect} from 'vitest'
import {ensureCryptoHash} from './cryptoHashPolyfill'
import {createHash} from 'node:crypto'

describe('ensureCryptoHash', () => {
  it('adds crypto.hash when missing', () => {
    // Remove if present to simulate Node 18
    const original = (crypto as any).hash
    ;(crypto as any).hash = undefined

    ensureCryptoHash()

    const result = (crypto as any).hash('sha256', 'hello')
    const expected = createHash('sha256').update('hello').digest('hex')

    expect(result).toBe(expected)

    // restore
    ;(crypto as any).hash = original
  })
})
