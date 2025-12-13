import * as nodeCrypto from 'node:crypto'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'

/**
 * Ensures a `crypto.hash` function exists.
 *
 * Newer Node versions (>=22) expose `crypto.hash`, but our CI matrix still runs
 * on Node 18 where it is undefined. Some tooling (Vite/Vitest internals) may
 * call `crypto.hash` when the newer type definitions are present, which causes
 * a runtime crash in CI. This shim backfills the API using `createHash`.
 */
export function ensureCryptoHash(): void {
  const require = createRequire(import.meta.url)
  let cjsCrypto: any
  try {
    cjsCrypto = require('node:crypto')
  } catch {
    cjsCrypto = undefined
  }
  const cryptoAny = globalThis.crypto as any

  const ensureOnTarget = (target: any) => {
    if (!target || typeof target.hash === 'function') return

    try {
      target.hash = (
        algorithm: string | {name: string},
        data: string | ArrayBuffer | NodeJS.ArrayBufferView,
        output: BufferEncoding | 'buffer' = 'hex'
      ) => {
        const algo = typeof algorithm === 'string' ? algorithm : algorithm?.name ?? 'sha256'
        const hasher = createHash(algo)

        if (typeof data === 'string') {
          hasher.update(data)
        } else if (ArrayBuffer.isView(data)) {
          hasher.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
        } else if (data instanceof ArrayBuffer) {
          hasher.update(Buffer.from(data))
        } else {
          hasher.update(String(data ?? ''))
        }

        const digest = hasher.digest()
        return output === 'buffer' ? digest : digest.toString(output)
      }
    } catch {
      /* non-extensible target, ignore */
    }
  }

  // Patch both global WebCrypto and the node:crypto module object
  ensureOnTarget(cryptoAny)
  ensureOnTarget(nodeCrypto as any)
  ensureOnTarget(cjsCrypto)
}
