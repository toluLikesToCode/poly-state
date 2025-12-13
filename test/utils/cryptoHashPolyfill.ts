import {createHash} from 'node:crypto'

/**
 * Ensures a `crypto.hash` function exists.
 *
 * Newer Node versions (>=22) expose `crypto.hash`, but our CI matrix still runs
 * on Node 18 where it is undefined. Some tooling (Vite/Vitest internals) may
 * call `crypto.hash` when the newer type definitions are present, which causes
 * a runtime crash in CI. This shim backfills the API using `createHash`.
 */
export function ensureCryptoHash(): void {
  const cryptoAny = globalThis.crypto as any
  if (!cryptoAny || typeof cryptoAny.hash === 'function') return

  cryptoAny.hash = (
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
}
