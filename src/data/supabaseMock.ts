/**
 * A stand-in for the Supabase client, used by the data-layer tests.
 *
 * The real client builds a query by chaining (`.from().select().eq()`) and only
 * runs it when the chain is awaited. This mirrors that: every method records
 * its call and returns the chain, and awaiting resolves to whatever result was
 * registered for that table. That lets a test assert both the query that was
 * built and the rows the caller mapped out of it.
 *
 * Test-only, but it lives in src/ so it type-checks against the real shapes.
 */

export interface Recorded {
  method: string
  args: unknown[]
}

export interface TableResult {
  data?: unknown
  error?: { message: string } | null
}

export interface MockClient {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  from: (table: string) => unknown
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<TableResult>
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: unknown, opts?: unknown) => Promise<{ error: unknown }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
      createSignedUrl: (
        path: string,
        seconds: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
    }
  }
  /** Every chained call, per table, in order. */
  calls: Record<string, Recorded[]>
  /** RPC invocations, in order. */
  rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }>
  /** Storage uploads, in order. */
  uploads: Array<{ bucket: string; path: string; opts?: unknown }>
  /** Convenience: the argument a given method was called with. */
  argFor: (table: string, method: string) => unknown
}

export function makeSupabaseMock(options: {
  userId?: string | null
  /** Result per table. A function receives the calls made so far. */
  results?: Record<string, TableResult | ((calls: Recorded[]) => TableResult)>
  /** Result per RPC function name. */
  rpcResults?: Record<string, TableResult>
  /** Error to return from a storage upload, if any. */
  uploadError?: { message: string } | null
}): MockClient {
  const { userId = 'me-uuid', results = {}, rpcResults = {}, uploadError = null } = options
  const calls: Record<string, Recorded[]> = {}
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = []
  const uploads: Array<{ bucket: string; path: string; opts?: unknown }> = []

  function chainFor(table: string) {
    const recorded = (calls[table] ||= [])
    const resolve = () => {
      const r = results[table] ?? { data: [], error: null }
      return typeof r === 'function' ? r(recorded) : r
    }
    const chain: Record<string | symbol, unknown> = {}
    return new Proxy(chain, {
      get(_t, prop) {
        // Awaiting the chain runs the query.
        if (prop === 'then') {
          return (onFulfilled: (v: TableResult) => unknown) => onFulfilled(resolve())
        }
        return (...args: unknown[]) => {
          recorded.push({ method: String(prop), args })
          return proxyRef
        }
      },
    })
  }

  let proxyRef: unknown
  const client: MockClient = {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: (table: string) => {
      proxyRef = chainFor(table)
      return proxyRef
    },
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return rpcResults[fn] ?? { data: [], error: null }
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _file: unknown, opts?: unknown) => {
          uploads.push({ bucket, path, opts })
          return { error: uploadError }
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/storage/${bucket}/${path}` },
        }),
        createSignedUrl: async (path: string, seconds: number) =>
          uploadError
            ? { data: null, error: uploadError }
            : {
                data: { signedUrl: `https://example.test/signed/${bucket}/${path}?exp=${seconds}` },
                error: null,
              },
      }),
    },
    calls,
    rpcCalls,
    uploads,
    argFor(table, method) {
      return (calls[table] ?? []).find((c) => c.method === method)?.args[0]
    },
  }
  return client
}
