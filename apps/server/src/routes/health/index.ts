import { Hono } from "hono";

import { type HealthReport, type Probe, runProbes } from "@/libs/health";
import { machineVitals } from "@/libs/machine";

export type HealthRouteConfig = {
  probes: Probe[];
  /** Live readers, not values: the guard and its limits change while the process runs. */
  inFlight: () => number;
  maxInFlight: () => number;
  /** How long one round of probes is reused. `0` probes on every request. */
  cacheMs?: number;
};

/** Two Fly check intervals: pollers see fresh data, a hot loop still probes once. */
const DEFAULT_CACHE_MS = 5_000;

/**
 * `GET /health` — readiness. Can this machine still reach Turso, Upstash,
 * Tinybird and Unkey?
 *
 * 503 only when a *critical* dependency is down. A degraded report stays 200:
 * the API can still serve most of its surface without Tinybird, and answering
 * 503 would tell every caller to fail over for a metrics outage.
 *
 * This is deliberately not the Fly check (`/ping` is). Wiring Fly here would
 * mean a Turso blip restarts every machine at once — losing the capacity that
 * has to absorb the recovery, and none of it would bring Turso back.
 */
export function createHealthRoute(config: HealthRouteConfig) {
  const cacheMs = config.cacheMs ?? DEFAULT_CACHE_MS;
  let cached: { at: number; report: HealthReport } | undefined;
  /** Concurrent callers share one round of probes instead of each starting their own. */
  let pending: Promise<HealthReport> | undefined;

  function report(): Promise<HealthReport> {
    const now = Date.now();
    if (cached && now - cached.at < cacheMs)
      return Promise.resolve(cached.report);
    if (pending) return pending;

    pending = runProbes(config.probes)
      .then((fresh) => {
        cached = { at: Date.now(), report: fresh };
        return fresh;
      })
      .finally(() => {
        pending = undefined;
      });

    return pending;
  }

  const health = new Hono({ strict: false });

  health.get("/health", async (c) => {
    const dependencies = await report();
    const vitals = machineVitals({
      inFlight: config.inFlight(),
      maxInFlight: config.maxInFlight(),
    });

    // A dependency outage outranks local pressure: it is the one a caller
    // can neither retry around nor wait out.
    const status =
      dependencies.status === "ok" && vitals.pressure.length
        ? "degraded"
        : dependencies.status;

    return c.json(
      {
        status,
        region: vitals.machine.region,
        requestId: c.get("requestId" as never) as string | undefined,
        checkedAt: dependencies.checkedAt,
        latencyMs: dependencies.latencyMs,
        checks: dependencies.checks,
        ...vitals,
      },
      status === "unhealthy" ? 503 : 200,
      { "Cache-Control": "no-store" },
    );
  });

  return health;
}
