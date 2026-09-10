import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { createRateLimit, credentialKey } from "./rate-limit";

type Env = { Variables: { event: Record<string, unknown> } };

const HUGE = 1_000_000;

// Limiters own an interval timer; build them at module scope, outside the sanitizer.
function build(config: {
  perMinute?: number;
  burstPer10s?: number;
  writesPerMinute?: number;
  publicPerMinute?: number;
}) {
  const app = new Hono<Env>();
  const events: Record<string, unknown>[] = [];
  let handled = 0;
  app.use("*", requestId());
  app.use("*", async (c, next) => {
    const event: Record<string, unknown> = {};
    events.push(event);
    c.set("event", event);
    await next();
  });
  app.use(
    "*",
    ...createRateLimit({
      perMinute: HUGE,
      burstPer10s: HUGE,
      writesPerMinute: HUGE,
      publicPerMinute: HUGE,
      ...config,
    }),
  );
  app.all("*", (c) => {
    handled++;
    return c.text("ok");
  });
  return { app, events, handled: () => handled };
}

const perMinute = build({ perMinute: 600 });
const burst = build({ burstPer10s: 3 });
const writes = build({ writesPerMinute: 2 });
const pub = build({ publicPerMinute: 2 });
const recovery = build({ burstPer10s: 1, perMinute: 2 });
const precedence = build({ burstPer10s: 1 });
const isolation = build({ perMinute: 1, publicPerMinute: 1 });
const keyApp = new Hono().get("/k", async (c) =>
  c.text(await credentialKey(c)),
);

const keyHeaders = (key: string) => ({ "x-openstatus-key": key });

async function fire(
  app: Hono<Env>,
  path: string,
  n: number,
  init?: RequestInit,
) {
  let last: Response | undefined;
  for (let i = 0; i < n; i++) last = await app.request(path, init);
  return last as Response;
}

describe("rate limit", () => {
  test("601st request in a window from one key gets 429", async () => {
    const { app, events } = perMinute;
    const ok = await fire(app, "/v1/monitor", 600, {
      headers: keyHeaders("a"),
    });
    expect(ok.status).toBe(200);

    const limited = await app.request("/v1/monitor", {
      headers: keyHeaders("a"),
    });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      requestId: expect.any(String),
    });
    expect(events.at(-1)?.rate_limited).toBe(true);
  });

  test("another key is unaffected", async () => {
    const { app } = perMinute;
    const res = await app.request("/v1/monitor", { headers: keyHeaders("b") });
    expect(res.status).toBe(200);
    const bearer = await app.request("/v1/monitor", {
      headers: { authorization: "Bearer os_oat_c" },
    });
    expect(bearer.status).toBe(200);
  });

  test("10 s bucket trips before the minute window", async () => {
    const { app } = burst;
    expect(
      (await fire(app, "/v1/monitor", 3, { headers: keyHeaders("a") })).status,
    ).toBe(200);
    expect(
      (await app.request("/v1/monitor", { headers: keyHeaders("a") })).status,
    ).toBe(429);
  });

  test("write limit covers /v1 mutations and mutating RPC methods, not reads or /mcp", async () => {
    const { app } = writes;
    const post = { method: "POST", headers: keyHeaders("a") };
    const svc = "/rpc/openstatus.monitor.v1.MonitorService";
    expect((await app.request("/v1/monitor", post)).status).toBe(200);
    expect((await app.request(`${svc}/CreateMonitor`, post)).status).toBe(200);
    const limited = await app.request(`${svc}/DeleteMonitor`, post);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    // Connect clients read the code from the body, so /rpc gets the Connect shape
    expect(await limited.json()).toEqual({
      code: "resource_exhausted",
      message: "Rate limit exceeded, retry later",
    });
    // reads over POST and JSON-RPC are not writes
    expect(
      (await app.request("/v1/monitor", { headers: keyHeaders("a") })).status,
    ).toBe(200);
    expect((await app.request(`${svc}/ListMonitors`, post)).status).toBe(200);
    expect((await app.request(`${svc}/GetMonitor`, post)).status).toBe(200);
    expect(
      (await app.request(`${svc}/GetMonitor`, { headers: keyHeaders("a") }))
        .status,
    ).toBe(200);
    expect((await app.request("/mcp", post)).status).toBe(200);
  });

  test("IP fallback keys anonymous /public/status/* requests", async () => {
    const { app } = pub;
    const ip1 = { headers: { "fly-client-ip": "203.0.113.1" } };
    const ip2 = { headers: { "x-forwarded-for": "203.0.113.2, 10.0.0.1" } };
    expect((await fire(app, "/public/status/acme", 2, ip1)).status).toBe(200);
    expect((await app.request("/public/status/acme", ip1)).status).toBe(429);
    expect((await app.request("/public/status/acme", ip2)).status).toBe(200);
  });

  test("/ping, /openapi* and /.well-known/* are unaffected", async () => {
    const { app } = burst;
    for (const path of [
      "/ping",
      "/openapi.json",
      "/.well-known/oauth-authorization-server",
    ]) {
      expect(
        (await fire(app, path, 5, { headers: keyHeaders("a") })).status,
      ).toBe(200);
    }
  });

  test("the raw key never appears in the key generator output", async () => {
    const raw = "os_live_super_secret_key";
    const key = await (
      await keyApp.request("/k", { headers: keyHeaders(raw) })
    ).text();
    expect(key).not.toContain(raw);
    expect(key).toMatch(/^key:[0-9a-f]{16}$/);
    const bearer = await (
      await keyApp.request("/k", {
        headers: { authorization: `Bearer ${raw}` },
      })
    ).text();
    expect(bearer).toBe(key);
    const anon = await (
      await keyApp.request("/k", {
        headers: { "fly-client-ip": "198.51.100.7" },
      })
    ).text();
    expect(anon).toBe("ip:198.51.100.7");
  });

  test("a limited request never reaches the handler and Retry-After stays within the window", async () => {
    const { app, handled } = burst;
    const before = handled();
    const limited = await app.request("/v1/monitor", {
      headers: keyHeaders("a"),
    });
    expect(limited.status).toBe(429);
    expect(handled()).toBe(before);
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(10);
    expect(await limited.json()).toMatchObject({
      message: "Rate limit exceeded, retry later",
      docs: "https://www.openstatus.dev/docs/api-references/errors/code/TOO_MANY_REQUESTS",
    });
  });

  test("the 10 s bucket recovers after its window while the minute window keeps counting", async () => {
    const { app } = recovery;
    const time = new FakeTime();
    try {
      const init = { headers: keyHeaders("a") };
      expect((await app.request("/v1/monitor", init)).status).toBe(200);
      expect((await app.request("/v1/monitor", init)).status).toBe(429);

      time.tick(10_001);
      expect((await app.request("/v1/monitor", init)).status).toBe(200);

      // minute window (limit 2) is now full even though the burst bucket reset
      time.tick(10_001);
      expect((await app.request("/v1/monitor", init)).status).toBe(429);

      time.tick(60_001);
      expect((await app.request("/v1/monitor", init)).status).toBe(200);
    } finally {
      time.restore();
    }
  });

  test("x-openstatus-key wins over a bearer token and fly-client-ip over x-forwarded-for", async () => {
    const { app } = precedence;
    // key + bearer counts against the key, so the same bearer alone is a different bucket
    const both = {
      headers: { "x-openstatus-key": "k1", authorization: "Bearer t1" },
    };
    expect((await app.request("/v1/monitor", both)).status).toBe(200);
    expect((await app.request("/v1/monitor", both)).status).toBe(429);
    expect(
      (
        await app.request("/v1/monitor", {
          headers: { authorization: "Bearer t1" },
        })
      ).status,
    ).toBe(200);

    const flyAndForwarded = {
      headers: {
        "fly-client-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.9",
      },
    };
    expect((await app.request("/v1/monitor", flyAndForwarded)).status).toBe(
      200,
    );
    expect((await app.request("/v1/monitor", flyAndForwarded)).status).toBe(
      429,
    );
    expect(
      (
        await app.request("/v1/monitor", {
          headers: { "x-forwarded-for": "198.51.100.9" },
        })
      ).status,
    ).toBe(200);
  });

  test("anonymous requests without any client IP share one bucket", async () => {
    const key = await (await keyApp.request("/k")).text();
    expect(key).toBe("ip:unknown");
  });

  test("a key exhausted on /v1 is still served on /public, and vice versa", async () => {
    const { app } = isolation;
    const ip = {
      headers: { ...keyHeaders("a"), "fly-client-ip": "203.0.113.5" },
    };
    expect((await app.request("/v1/monitor", ip)).status).toBe(200);
    expect((await app.request("/v1/monitor", ip)).status).toBe(429);
    expect((await app.request("/public/status/acme", ip)).status).toBe(200);
    expect((await app.request("/public/status/acme", ip)).status).toBe(429);
    // the public bucket being full does not touch a fresh key on /v1
    expect(
      (
        await app.request("/v1/monitor", {
          headers: {
            ...keyHeaders("b"),
            ...ip.headers,
            "x-openstatus-key": "b",
          },
        })
      ).status,
    ).toBe(200);
  });
});
