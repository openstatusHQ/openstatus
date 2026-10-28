import { describe, expect, test } from "vitest";

import {
  MAX_BODY_BYTES,
  captureHeaders,
  captureIp,
  captureUserAgent,
  readCappedBody,
  redactHeartbeatToken,
} from "./capture";

describe("captureHeaders", () => {
  test("redacts secrets and drops infrastructure headers", () => {
    const headers = new Headers({
      authorization: "Bearer abc",
      cookie: "session=1",
      "x-github-signature": "sha256=deadbeef",
      "x-request-token": "t",
      "fly-client-ip": "1.2.3.4",
      "x-forwarded-for": "1.2.3.4",
      host: "api.openstatus.dev",
      "content-type": "application/json",
    });

    const parsed = JSON.parse(captureHeaders(headers) ?? "{}");

    expect(parsed).toEqual({
      authorization: "[redacted]",
      cookie: "[redacted]",
      "x-github-signature": "[redacted]",
      "x-request-token": "[redacted]",
      "content-type": "application/json",
    });
  });

  test("returns null when nothing is left", () => {
    expect(captureHeaders(new Headers({ host: "x" }))).toBeNull();
  });

  test("leaves out whole entries past 4 KB and stays valid JSON", () => {
    const headers = new Headers({
      "x-big": "a".repeat(10_000),
      "x-medium-1": "b".repeat(2_500),
      "x-medium-2": "c".repeat(2_500),
      "content-type": "text/plain",
    });

    const captured = captureHeaders(headers) ?? "";

    expect(new TextEncoder().encode(captured).byteLength).toBeLessThanOrEqual(
      4 * 1024,
    );
    const parsed = JSON.parse(captured);
    expect(parsed["content-type"]).toBe("text/plain");
    expect(parsed["x-big"]).toBeUndefined();
    expect(parsed["x-medium-1"]).toHaveLength(2_500);
    expect(parsed["x-medium-2"]).toBeUndefined();
  });
});

describe("captureIp / captureUserAgent", () => {
  test("prefers fly-client-ip, else the last forwarded hop", () => {
    expect(captureIp(new Headers({ "fly-client-ip": "9.9.9.9" }))).toBe(
      "9.9.9.9",
    );
    expect(
      captureIp(new Headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" })),
    ).toBe("7.7.7.7");
    expect(captureIp(new Headers())).toBeNull();
  });

  test("cuts the user agent at 256 chars", () => {
    const ua = captureUserAgent(new Headers({ "user-agent": "u".repeat(500) }));
    expect(ua).toHaveLength(256);
  });
});

describe("readCappedBody", () => {
  test("keeps a small body whole", async () => {
    const result = await readCappedBody(
      new Request("http://x", { method: "POST", body: "done in 3s" }),
    );
    expect(result).toEqual({ body: "done in 3s", truncated: false });
  });

  test("cuts a large body at 10 KB and flags it", async () => {
    const result = await readCappedBody(
      new Request("http://x", { method: "POST", body: "a".repeat(50_000) }),
    );
    expect(result.truncated).toBe(true);
    expect(result.body).toHaveLength(MAX_BODY_BYTES);
  });

  test("does not leave a broken multi-byte character at the cut", async () => {
    // the ASCII prefix puts the 10 KB cut in the middle of an `é`
    const result = await readCappedBody(
      new Request("http://x", {
        method: "POST",
        body: `a${"é".repeat(6_000)}`,
      }),
    );
    expect(result.truncated).toBe(true);
    expect(result.body).toBe(`a${"é".repeat((MAX_BODY_BYTES - 2) / 2)}`);
  });

  test("scrubs secrets from the body", async () => {
    const result = await readCappedBody(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ status: "ok", api_key: "sk_live_123" }),
      }),
    );
    expect(result.body).not.toContain("sk_live_123");
    expect(JSON.parse(result.body ?? "{}")).toEqual({
      status: "ok",
      api_key: "[redacted]",
    });
  });

  test("returns null without a body", async () => {
    expect(await readCappedBody(new Request("http://x"))).toEqual({
      body: null,
      truncated: false,
    });
  });
});

test("redactHeartbeatToken", () => {
  expect(redactHeartbeatToken("https://api.dev/heartbeat/abc123?x=1")).toBe(
    "https://api.dev/heartbeat/[redacted]?x=1",
  );
  expect(redactHeartbeatToken("/v1/monitor")).toBe("/v1/monitor");
});
