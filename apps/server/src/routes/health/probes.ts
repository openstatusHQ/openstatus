import { db, sql } from "@openstatus/db";

import { env } from "@/env";
import { redis } from "@/libs/clients";
import type { Probe } from "@/libs/health";

/**
 * The services this API cannot do its job without.
 *
 * Only Turso is critical: every route reads or writes it, so a machine that
 * cannot reach it has nothing to serve. Redis backs caches and the Slack
 * confirmation store, Tinybird backs the metrics endpoints and Unkey only the
 * legacy key path — losing any of those costs features, not the API.
 */

/** Health checks queue behind real traffic, so they get a short leash. */
const TIMEOUT_MS = 2_000;

/** `skipValidation` never runs the schemas, so the env default never applies — it lands here. */
const TINYBIRD_URL = env.TINYBIRD_URL || "https://api.tinybird.co";

export function probesFromEnv(): Probe[] {
  return [
    {
      name: "database",
      critical: true,
      timeoutMs: TIMEOUT_MS,
      // Turso over HTTP: no pool to exhaust, and `select 1` never touches a table.
      run: () => db.run(sql`select 1`),
    },
    {
      name: "redis",
      critical: false,
      timeoutMs: TIMEOUT_MS,
      // Unset locally; without a URL the client just retries into the deadline.
      skip: () => !env.UPSTASH_REDIS_REST_URL,
      run: () => redis.ping(),
    },
    {
      name: "tinybird",
      critical: false,
      timeoutMs: TIMEOUT_MS,
      // `noop` mode answers from nothing, so there is no dependency to probe.
      skip: () => env.TINYBIRD_NOOP,
      // Reachability only. Our token is workspace-scoped and cannot list pipes
      // (`/v0/pipes` answers 403), so an authenticated probe would report a
      // healthy Tinybird as down. A bad token surfaces on the metrics routes.
      run: (signal) => expectOk(fetch(`${TINYBIRD_URL}/v0/health`, { signal })),
    },
    {
      name: "unkey",
      critical: false,
      timeoutMs: TIMEOUT_MS,
      run: (signal) =>
        expectOk(fetch("https://api.unkey.com/v2/liveness", { signal })),
    },
  ];
}

async function expectOk(pending: Promise<Response>): Promise<void> {
  const res = await pending;
  // Drain the body or Deno holds the connection open and the test runner
  // reports a leaked resource.
  await res.body?.cancel();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
