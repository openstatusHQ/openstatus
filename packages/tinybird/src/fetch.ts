import type { Tinybird } from "@chronark/zod-bird";

const MAX_ATTEMPTS = 10;

export class TinybirdHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TinybirdHttpError";
  }
}

async function errorDetail(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {}
  return text.slice(0, 200);
}

/**
 * zod-bird's retry loop with the same backoff, except that running out of
 * attempts throws with the last status instead of resolving `undefined`.
 */
export async function tinybirdFetch(
  url: string | URL,
  opts: RequestInit,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<unknown> {
  let res: Response | undefined;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    res = await fetch(url, opts);
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      if (i < MAX_ATTEMPTS - 1) await sleep(1000 + i ** 2 * 50);
      continue;
    }
    if (res.status === 403) throw new TinybirdHttpError(403, "Unauthorized");
    throw new TinybirdHttpError(res.status, await errorDetail(res));
  }
  // safe because the loop ran at least once
  const last = res as Response;
  throw new TinybirdHttpError(
    last.status,
    `Tinybird ${last.status} after ${MAX_ATTEMPTS} attempts: ${await errorDetail(last)}`,
  );
}

// zod-bird declares `fetch` private and gives no way to inject one; every pipe
// and ingest call goes through `this.fetch(url, opts)` (zod-bird 1.0.0).
export function withStatusErrors(client: Tinybird): Tinybird {
  (client as unknown as { fetch: typeof tinybirdFetch }).fetch = (url, opts) =>
    tinybirdFetch(url, opts);
  return client;
}
