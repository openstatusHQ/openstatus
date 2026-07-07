import { expect } from "@std/expect";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { spy } from "@std/testing/mock";
import { Cause, Effect, Exit, Option } from "effect";
import { z } from "zod";

import {
  FetchError,
  fetchJson,
  fetchText,
  fetchTextWithUrl,
} from "../src/fetch";

const TEST_URL = "https://api.example.com/status";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

const installMockFetch = (impl: FetchImpl) => {
  const fn = spy(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

const okJson = (body: Record<string, string>): Response =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

const errorResponse = (status: number, statusText: string): Response =>
  ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => "",
  }) as Response;

const okText = (body: string): Response =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
    json: async () => JSON.parse(body),
  }) as Response;

const expectFailure = <A>(exit: Exit.Exit<A, FetchError>): FetchError => {
  if (!Exit.isFailure(exit)) {
    throw new Error("expected Exit.Failure");
  }
  const failure = Cause.failureOption(exit.cause);
  if (Option.isNone(failure)) {
    throw new Error("expected Cause.Fail");
  }
  return failure.value;
};

describe("fetchJson", () => {
  beforeEach(() => {
    installMockFetch(() => Promise.resolve(okJson({ ok: "yes" })));
  });

  it("returns parsed body on 200", async () => {
    installMockFetch(() => Promise.resolve(okJson({ name: "OpenStatus" })));
    const schema = z.object({ name: z.string() });
    const result = await Effect.runPromise(
      fetchJson({ url: TEST_URL, schema }),
    );
    expect(result.name).toBe("OpenStatus");
  });

  it("fails with FetchError carrying httpStatus on 4xx and does not retry", async () => {
    const fetchMock = installMockFetch(() =>
      Promise.resolve(errorResponse(404, "Not Found")),
    );
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema, fetcherName: "test", entryId: "x" }),
    );
    const err = expectFailure(exit);
    expect(err.httpStatus).toBe(404);
    expect(err.kind).toBe("http");
    expect(err.fetcherName).toBe("test");
    expect(err.entryId).toBe("x");
    expect(fetchMock.calls.length).toBe(1);
  });

  it("retries up to 3 times on 5xx then fails", async () => {
    const fetchMock = installMockFetch(() =>
      Promise.resolve(errorResponse(503, "Service Unavailable")),
    );
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema }),
    );
    const err = expectFailure(exit);
    expect(err.httpStatus).toBe(503);
    expect(fetchMock.calls.length).toBe(4);
  });

  it("retries up to 3 times on network error then fails", async () => {
    const fetchMock = installMockFetch(() =>
      Promise.reject(new Error("ECONNRESET")),
    );
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema }),
    );
    const err = expectFailure(exit);
    expect(err.httpStatus).toBeUndefined();
    expect(err.kind).toBe("network");
    expect(fetchMock.calls.length).toBe(4);
  });

  it("fails with FetchError on schema mismatch without retrying", async () => {
    const fetchMock = installMockFetch(() =>
      Promise.resolve(okJson({ unexpected: "shape" })),
    );
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema }),
    );
    const err = expectFailure(exit);
    expect(err.cause).toBeInstanceOf(Error);
    expect(err.kind).toBe("parse");
    expect(fetchMock.calls.length).toBe(1);
  });

  it("classifies a non-JSON 200 body as parse", async () => {
    installMockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => JSON.parse("<html>"),
        text: async () => "<html>",
      } as Response),
    );
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema }),
    );
    expect(expectFailure(exit).kind).toBe("parse");
  });

  it("classifies a timeout as timeout", async () => {
    installMockFetch(() => new Promise<Response>(() => {}));
    const schema = z.object({ name: z.string() });
    const exit = await Effect.runPromiseExit(
      fetchJson({ url: TEST_URL, schema, timeout: "20 millis" }),
    );
    expect(expectFailure(exit).kind).toBe("timeout");
  });

  it("applies default User-Agent and Accept headers", async () => {
    let capturedInit: RequestInit | undefined;
    installMockFetch((_url, init) => {
      capturedInit = init;
      return Promise.resolve(okJson({ ok: "yes" }));
    });
    const schema = z.object({ ok: z.string() });
    await Effect.runPromise(fetchJson({ url: TEST_URL, schema }));
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("OpenStatus-Directory/1.0");
    expect(headers.Accept).toBe("application/json");
  });

  it("merges caller headers over defaults", async () => {
    let capturedInit: RequestInit | undefined;
    installMockFetch((_url, init) => {
      capturedInit = init;
      return Promise.resolve(okJson({ ok: "yes" }));
    });
    const schema = z.object({ ok: z.string() });
    await Effect.runPromise(
      fetchJson({
        url: TEST_URL,
        schema,
        init: { headers: { "User-Agent": "Custom/1.0", "X-Trace": "abc" } },
      }),
    );
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Custom/1.0");
    expect(headers.Accept).toBe("application/json");
    expect(headers["X-Trace"]).toBe("abc");
  });

  it("passes through method and body from init", async () => {
    let capturedInit: RequestInit | undefined;
    installMockFetch((_url, init) => {
      capturedInit = init;
      return Promise.resolve(okJson({ ok: "yes" }));
    });
    const schema = z.object({ ok: z.string() });
    await Effect.runPromise(
      fetchJson({
        url: TEST_URL,
        schema,
        init: { method: "POST", body: '{"k":"v"}' },
      }),
    );
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBe('{"k":"v"}');
  });
});

describe("fetchText", () => {
  it("returns response.text() verbatim", async () => {
    installMockFetch(() => Promise.resolve(okText("<html>ok</html>")));
    const result = await Effect.runPromise(fetchText({ url: TEST_URL }));
    expect(result).toBe("<html>ok</html>");
  });

  it("applies browser-ish default User-Agent", async () => {
    let capturedInit: RequestInit | undefined;
    installMockFetch((_url, init) => {
      capturedInit = init;
      return Promise.resolve(okText("body"));
    });
    await Effect.runPromise(fetchText({ url: TEST_URL }));
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      "Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)",
    );
  });

  it("retries on 5xx then fails", async () => {
    const fetchMock = installMockFetch(() =>
      Promise.resolve(errorResponse(500, "Server Error")),
    );
    const exit = await Effect.runPromiseExit(fetchText({ url: TEST_URL }));
    const err = expectFailure(exit);
    expect(err.httpStatus).toBe(500);
    expect(fetchMock.calls.length).toBe(4);
  });
});

describe("fetchBody timeouts", () => {
  it("times out a stalled body read", async () => {
    installMockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => new Promise<string>(() => {}),
        json: async () => ({}),
      } as Response),
    );
    const exit = await Effect.runPromiseExit(
      fetchText({ url: TEST_URL, timeout: "20 millis" }),
    );
    expect(expectFailure(exit).kind).toBe("timeout");
  });
});

describe("fetchTextWithUrl", () => {
  it("returns text and the final URL after redirects", async () => {
    installMockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://final.example.com/status",
        text: async () => "<html>ok</html>",
        json: async () => ({}),
      } as Response),
    );
    const result = await Effect.runPromise(fetchTextWithUrl({ url: TEST_URL }));
    expect(result.text).toBe("<html>ok</html>");
    expect(result.finalUrl).toBe("https://final.example.com/status");
  });
});

describe("FetchError", () => {
  it("formats message with fetcherName and entryId", () => {
    const err = new FetchError({
      url: "https://example.com",
      fetcherName: "atlassian",
      entryId: "github",
      httpStatus: 503,
    });
    expect(err.message).toBe(
      "[atlassian (github)] HTTP 503: https://example.com",
    );
    expect(err.name).toBe("FetchError");
    expect(err.url).toBe("https://example.com");
  });

  it("uses 'fetch failed' when no httpStatus", () => {
    const err = new FetchError({ url: "https://x.com" });
    expect(err.message).toBe("[FetchError] fetch failed: https://x.com");
  });

  it("preserves cause", () => {
    const cause = new Error("boom");
    const err = new FetchError({ url: "https://x.com", cause });
    expect(err.cause).toBe(cause);
  });
});
