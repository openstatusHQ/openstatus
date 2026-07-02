import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import type { RegionCheckerResponse } from "@/lib/checker/utils";

import { mapCheckToCdnResult, probeCdnRegion } from "./probe";

const timing = {
  dnsStart: 0,
  dnsDone: 2,
  connectStart: 2,
  connectDone: 3,
  tlsHandshakeStart: 3,
  tlsHandshakeDone: 8,
  firstByteStart: 8,
  firstByteDone: 46,
  transferStart: 46,
  transferDone: 49,
};

describe("mapCheckToCdnResult", () => {
  test("maps a cloudflare HIT", () => {
    const check: RegionCheckerResponse = {
      type: "http",
      state: "success",
      region: "iad",
      status: 200,
      latency: 71,
      timestamp: 0,
      timing,
      headers: {
        "Cf-Cache-Status": "HIT",
        "Cf-Ray": "8c9a1b2c3d4e5f6a-IAD",
        Server: "cloudflare",
        Age: "842",
        "Cache-Control": "public, max-age=3600",
        Etag: 'W/"abc123"',
        "Content-Length": "18233",
      },
    };
    const result = mapCheckToCdnResult(check);
    if (result.state !== "success") throw new Error("expected success");
    expect(result.cacheStatus).toBe("HIT");
    expect(result.cacheStatusRaw).toBe("cf-cache-status: HIT");
    expect(result.cdn).toBe("cloudflare");
    expect(result.edgePop).toBe("IAD");
    expect(result.ttfbMs).toBe(38);
    expect(result.totalMs).toBe(71);
    expect(result.responseSize).toBe(18233);
    expect(result.age).toBe(842);
    expect(result.etag).toBe('W/"abc123"');
    expect(result.edgeIp).toBeNull();
  });

  test("falls back to body byte length without content-length", () => {
    const check: RegionCheckerResponse = {
      type: "http",
      state: "success",
      region: "ams",
      status: 200,
      latency: 100,
      timestamp: 0,
      timing,
      headers: {},
      body: "hello",
    };
    const result = mapCheckToCdnResult(check);
    if (result.state !== "success") throw new Error("expected success");
    expect(result.responseSize).toBe(5);
    expect(result.cacheStatus).toBe("UNKNOWN");
    expect(result.cdn).toBeNull();
  });

  test("passes error responses through", () => {
    const check: RegionCheckerResponse = {
      state: "error",
      region: "syd",
      message: "connection refused",
    };
    const result = mapCheckToCdnResult(check);
    expect(result).toEqual({
      state: "error",
      region: "syd",
      message: "connection refused",
    });
  });
});

describe("probeCdnRegion abort propagation", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("forwards an abort signal to the underlying fetch", async () => {
    let received: AbortSignal | undefined;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      received = init?.signal ?? undefined;
      return new Response(
        JSON.stringify({
          type: "http",
          state: "success",
          status: 200,
          latency: 10,
          headers: { "Cf-Cache-Status": "HIT", "Cf-Ray": "abc-FRA" },
          timestamp: 0,
          timing,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await probeCdnRegion({
      url: "https://example.com",
      region: "fra",
    });
    expect(result.state).toBe("success");
    expect(received).toBeInstanceOf(AbortSignal);
  });

  test("aborts the fetch when the timeout elapses and returns a Timeout row", async () => {
    globalThis.fetch = ((_input: unknown, init?: RequestInit) => {
      // resolve only when the signal aborts, mirroring a hung request
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason ?? new Error("aborted")),
        );
      });
    }) as typeof fetch;

    const result = await probeCdnRegion({
      url: "https://example.com",
      region: "fra",
      timeoutMs: 20,
    });
    expect(result).toEqual({
      state: "error",
      region: "fra",
      message: "Timeout",
    });
  });
});
