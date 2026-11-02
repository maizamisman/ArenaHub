/** Calls fn again after a failure (same arguments, so a request id is reused), then gives up. */
export async function withRetry<T>(fn: () => Promise<T>, opts: { attempts: number; delayMs: number }): Promise<T> {
  let last: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < opts.attempts - 1) await new Promise((res) => setTimeout(res, opts.delayMs * (i + 1))); }
  }
  throw last;
}
