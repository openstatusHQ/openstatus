import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import { testGrpc, testHttp, testTcp } from "./checker";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Stub the checker with one canned JSON body. */
function stubChecker(body: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )) as typeof globalThis.fetch;
}

/** Make the checker fetch reject, e.g. with the AbortSignal.timeout error. */
function stubCheckerRejects(error: unknown) {
  globalThis.fetch = (() => Promise.reject(error)) as typeof globalThis.fetch;
}

/** Count console.error calls while `fn` runs, then restore. */
async function countErrors(fn: () => Promise<unknown>): Promise<number> {
  const origError = console.error;
  let count = 0;
  console.error = () => {
    count++;
  };
  try {
    await fn().catch(() => {});
  } finally {
    console.error = origError;
  }
  return count;
}

const timing = {
  dnsStart: 1,
  dnsDone: 2,
  connectStart: 2,
  connectDone: 3,
  tlsHandshakeStart: 3,
  tlsHandshakeDone: 4,
  firstByteStart: 4,
  firstByteDone: 5,
  transferStart: 5,
  transferDone: 6,
};

describe("testHttp", () => {
  const input = {
    url: "https://example.com",
    method: "GET" as const,
    region: "ams" as const,
    assertions: [],
  };

  test("accepts a 2XX response", async () => {
    stubChecker({
      status: 200,
      latency: 5,
      headers: {},
      timestamp: 1_700_000_000_000,
      timing,
      region: "ams",
    });

    const result = await testHttp(input);
    expect(result.state).toBe("success");
  });

  test("maps the unreachable shape to its error message without logging", async () => {
    // `checker.Http` answers 200 with `error` set and status/headers omitted.
    stubChecker({
      error: "Timeout after 45000 ms",
      latency: 45000,
      timestamp: 1_700_000_000_000,
      timing,
      region: "ams",
    });

    await expect(testHttp(input)).rejects.toThrow("Timeout after 45000 ms");
    expect(await countErrors(() => testHttp(input))).toBe(0);
  });

  test("does not log a failed assertion", async () => {
    stubChecker({
      status: 500,
      latency: 5,
      headers: {},
      timestamp: 1_700_000_000_000,
      timing,
      region: "ams",
    });

    await expect(testHttp(input)).rejects.toThrow("Assertion error");
    expect(await countErrors(() => testHttp(input))).toBe(0);
  });

  test("maps a checker timeout to BAD_REQUEST without logging", async () => {
    stubCheckerRejects(new DOMException("timed out", "TimeoutError"));

    const error = await testHttp(input).catch((e) => e);
    expect(error.code).toBe("BAD_REQUEST");
    expect(await countErrors(() => testHttp(input))).toBe(0);
  });

  test("still logs an unexpected failure", async () => {
    stubCheckerRejects(new TypeError("fetch failed"));

    const error = await testHttp(input).catch((e) => e);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(await countErrors(() => testHttp(input))).toBe(1);
  });
});

describe("testTcp", () => {
  const input = { url: "example.com:443", region: "ams" as const };

  test("does not log an unreachable target", async () => {
    stubChecker({ message: "uri not reachable" });

    await expect(testTcp(input)).rejects.toThrow("uri not reachable");
    expect(await countErrors(() => testTcp(input))).toBe(0);
  });
});

/**
 * The shape GRPCHandlerRegion returns for a completed RPC. `state` is absent —
 * the handler never sends it — so grpcOutput prefaults it to "success".
 */
function completedResponse(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    jobType: "grpc",
    region: "ams",
    timestamp: 1_700_000_000_000,
    timing: {
      dnsStart: 1,
      dnsDone: 2,
      connectStart: 2,
      connectDone: 3,
      tlsHandshakeStart: 3,
      tlsHandshakeDone: 4,
      firstByteStart: 4,
      firstByteDone: 5,
      transferStart: 5,
      transferDone: 6,
    },
    latency: 5,
    completed: true,
    ...overrides,
  };
}

describe("testGrpc", () => {
  test("accepts a SERVING target", async () => {
    // `error` is omitempty in Go, so a healthy check omits it entirely.
    stubChecker(completedResponse({ servingStatus: "SERVING" }));

    const result = await testGrpc({
      url: "api.example.com:443",
      tls: "tls",
      region: "ams",
    });
    expect(result.state).toBe("success");
  });

  test("rejects a completed check that answered NOT_SERVING", async () => {
    stubChecker(
      completedResponse({
        servingStatus: "NOT_SERVING",
        error: 1,
        errorMessage: "service reports NOT_SERVING",
      }),
    );

    await expect(
      testGrpc({ url: "api.example.com:443", tls: "tls", region: "ams" }),
    ).rejects.toThrow("service reports NOT_SERVING");
  });

  test("rejects a server with no health service", async () => {
    stubChecker(
      completedResponse({
        error: 1,
        errorMessage: "server does not implement grpc.health.v1.Health",
      }),
    );

    await expect(
      testGrpc({ url: "api.example.com:443", tls: "tls", region: "ams" }),
    ).rejects.toThrow("does not implement");
  });

  test("falls back to the serving status when no message is sent", async () => {
    stubChecker(
      completedResponse({ servingStatus: "SERVICE_UNKNOWN", error: 1 }),
    );

    await expect(
      testGrpc({ url: "api.example.com:443", tls: "tls", region: "ams" }),
    ).rejects.toThrow("SERVICE_UNKNOWN");
  });

  test("still rejects a transport failure", async () => {
    // The only shape that carries `state` explicitly.
    stubChecker({ message: "uri not reachable" });

    await expect(
      testGrpc({ url: "api.example.com:443", tls: "tls", region: "ams" }),
    ).rejects.toThrow("uri not reachable");
  });
});
