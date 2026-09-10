import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { app } from "@/index";
import { concurrencyGuard } from "@/libs/middlewares/concurrency";
import { limits } from "@/libs/middlewares/limits";

/**
 * Wiring test: the guards must be mounted in the real app, after the wide
 * event and before every route. Limits are lowered on the in-isolate
 * `limits` object, never via `Deno.env`, which is shared by parallel workers.
 */
const original = { ...limits };
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  limits.burstPer10s = 2;
  limits.publicPerMinute = 1;
  limits.maxInFlight = 1;
});

afterAll(() => {
  Object.assign(limits, original);
});

describe("overload guards are wired into the app", () => {
  test("rate limits an authenticated caller before routing, with a matching request id", async () => {
    const init = { headers: { "x-openstatus-key": "wiring-burst" } };
    expect((await app.request("/no-such-route", init)).status).toBe(404);
    expect((await app.request("/no-such-route", init)).status).toBe(404);

    const limited = await app.request("/no-such-route", init);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    const body = await limited.json();
    expect(body.code).toBe("TOO_MANY_REQUESTS");
    expect(body.requestId).toBe(limited.headers.get("x-request-id"));
  });

  test("rate limits anonymous /public traffic per IP", async () => {
    const init = { headers: { "fly-client-ip": "203.0.113.77" } };
    expect(
      (await app.request("/public/status/no-such-page", init)).status,
    ).not.toBe(429);
    expect(
      (await app.request("/public/status/no-such-page", init)).status,
    ).toBe(429);
    expect(
      (
        await app.request("/public/status/no-such-page", {
          headers: { "fly-client-ip": "203.0.113.78" },
        })
      ).status,
    ).not.toBe(429);
  });

  test("/ping and the OpenAPI document are never limited", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await app.request("/ping")).status).toBe(200);
      expect((await app.request("/openapi.json")).status).toBe(200);
    }
  });
});

describe("in-flight cap through the app (needs the test database)", () => {
  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  let release: (() => void) | undefined;

  beforeAll(() => {
    // Hold the checker call so the request stays in flight; the DB client keeps the real fetch.
    globalThis.fetch = (() => {
      fetchCalls++;
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve(
            new Response(
              JSON.stringify({
                status: 200,
                latency: 1,
                timestamp: 1,
                region: "ams",
                timing: {
                  dnsStart: 1,
                  dnsDone: 2,
                  connectStart: 3,
                  connectDone: 4,
                  tlsHandshakeStart: 5,
                  tlsHandshakeDone: 6,
                  firstByteStart: 7,
                  firstByteDone: 8,
                  transferStart: 9,
                  transferDone: 10,
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
          );
      });
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  test("sheds the second request while the first is in flight, then recovers", async () => {
    const held = app.request("/v1/check/http", {
      method: "POST",
      headers: { "x-openstatus-key": "1", "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://www.openstatus.dev",
        regions: ["ams"],
        method: "GET",
      }),
    });
    // wait until the route is blocked on the checker call, i.e. truly in flight
    for (let i = 0; i < 2000 && fetchCalls === 0; i++) await tick();
    expect(fetchCalls).toBe(1);
    expect(concurrencyGuard.inFlight()).toBe(1);

    const shed = await app.request("/no-such-route");
    expect(shed.status).toBe(503);
    expect(shed.headers.get("retry-after")).toBe("5");
    expect((await shed.json()).code).toBe("SERVICE_UNAVAILABLE");

    release?.();
    expect((await held).status).toBe(200);
    expect(concurrencyGuard.inFlight()).toBe(0);
    expect((await app.request("/no-such-route")).status).toBe(404);
  });
});
