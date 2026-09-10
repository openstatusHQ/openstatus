import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { Probe } from "@/libs/health";
import { createHealthRoute } from "@/routes/health";

function route(
  probes: Probe[],
  over: { cacheMs?: number; inFlight?: number } = {},
) {
  return createHealthRoute({
    probes,
    inFlight: () => over.inFlight ?? 0,
    maxInFlight: () => 128,
    cacheMs: over.cacheMs ?? 0,
  });
}

const ok = (name: string, critical = false): Probe => ({
  name,
  critical,
  timeoutMs: 50,
  run: () => Promise.resolve(),
});

const down = (name: string, critical = false): Probe => ({
  ...ok(name, critical),
  run: () => Promise.reject(new Error("unreachable")),
});

describe("GET /health", () => {
  test("reports every dependency it probed", async () => {
    const res = await route([ok("database", true), ok("redis")]).request(
      "/health",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks).toMatchObject([
      { name: "database", critical: true, status: "ok" },
      { name: "redis", critical: false, status: "ok" },
    ]);
    expect(body.checks[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.machine.runtime).toBe(`deno/${Deno.version.deno}`);
    expect(body.memory.rssBytes).toBeGreaterThan(0);
    expect(body.pressure).toEqual([]);
  });

  test("stays 200 when a dependency we can live without is down", async () => {
    const res = await route([ok("database", true), down("tinybird")]).request(
      "/health",
    );

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("degraded");
  });

  test("answers 503 when turso is unreachable", async () => {
    const res = await route([down("database", true), ok("redis")]).request(
      "/health",
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks[0]).toMatchObject({
      status: "down",
      error: "unreachable",
    });
  });

  test("a saturated machine is degraded even with every dependency up", async () => {
    const res = await route([ok("database", true)], { inFlight: 120 }).request(
      "/health",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.pressure).toEqual(["120 of 128 in-flight slots taken"]);
  });

  test("reuses one round of probes inside the cache window", async () => {
    let runs = 0;
    const counted: Probe = {
      ...ok("database", true),
      run: () => {
        runs++;
        return Promise.resolve();
      },
    };
    const health = route([counted], { cacheMs: 10_000 });

    await health.request("/health");
    await health.request("/health");
    expect(runs).toBe(1);
  });

  test("concurrent callers share one round rather than each starting their own", async () => {
    let runs = 0;
    let release: (() => void) | undefined;
    const held: Probe = {
      ...ok("database", true),
      run: () => {
        runs++;
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    };
    const health = route([held], { cacheMs: 0 });

    const first = health.request("/health");
    const second = health.request("/health");
    await new Promise((r) => setTimeout(r, 0));
    release?.();

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(runs).toBe(1);
  });
});
