import { describe, expect, test } from "bun:test";
import {
  normalizeUrlForStorage,
  parseBearerChallenge,
  toPersistedReport,
} from "./health-check";
import type { HealthCheckReport } from "./health-check";

describe("parseBearerChallenge", () => {
  test("returns null for null/empty/non-Bearer", () => {
    expect(parseBearerChallenge(null)).toBeNull();
    expect(parseBearerChallenge("")).toBeNull();
    expect(parseBearerChallenge("Basic realm=foo")).toBeNull();
    expect(parseBearerChallenge("DPoP")).toBeNull();
  });

  test("Bearer alone with no params", () => {
    expect(parseBearerChallenge("Bearer")).toEqual({});
  });

  test("Bearer with realm and scope", () => {
    const out = parseBearerChallenge('Bearer realm="mcp", scope="read write"');
    expect(out).toEqual({ realm: "mcp", scope: "read write" });
  });

  test("Bearer with resource_metadata URL (quoted, internal comma in path)", () => {
    const header =
      'Bearer realm="x", resource_metadata="https://example.com/.well-known/oauth-protected-resource"';
    expect(parseBearerChallenge(header)).toEqual({
      realm: "x",
      resource_metadata:
        "https://example.com/.well-known/oauth-protected-resource",
    });
  });

  test("Bearer values with commas inside quotes are preserved", () => {
    const header = 'Bearer error_description="missing, token", realm="x"';
    const out = parseBearerChallenge(header);
    expect(out?.error_description).toBe("missing, token");
    expect(out?.realm).toBe("x");
  });

  test("multi-scheme header — picks Bearer", () => {
    const header = 'DPoP algs="ES256", Bearer realm="mcp"';
    const out = parseBearerChallenge(header);
    expect(out?.realm).toBe("mcp");
  });

  test("case-insensitive Bearer", () => {
    expect(parseBearerChallenge('BEARER realm="x"')?.realm).toBe("x");
    expect(parseBearerChallenge("bearer realm=foo")?.realm).toBe("foo");
  });

  test("unquoted token68 values", () => {
    expect(parseBearerChallenge("Bearer realm=mcp scope=read")).toEqual({
      realm: "mcp",
      scope: "read",
    });
  });

  test("keys are lowercased", () => {
    expect(parseBearerChallenge('Bearer Realm="x"')?.realm).toBe("x");
    expect(parseBearerChallenge('Bearer ERROR="invalid_token"')?.error).toBe(
      "invalid_token",
    );
  });
});

describe("normalizeUrlForStorage", () => {
  test("strips userinfo, query, fragment", () => {
    expect(
      normalizeUrlForStorage("https://u:p@example.com/mcp?token=secret#x"),
    ).toBe("https://example.com/mcp");
  });

  test("keeps explicit port", () => {
    expect(normalizeUrlForStorage("https://example.com:8443/mcp")).toBe(
      "https://example.com:8443/mcp",
    );
  });

  test("invalid URL returns input unchanged", () => {
    expect(normalizeUrlForStorage("not a url")).toBe("not a url");
  });
});

describe("toPersistedReport", () => {
  const baseReport: HealthCheckReport = {
    url: "https://example.com/mcp",
    timestamp: 1_700_000_000_000,
    verdict: "healthy",
    initialize: { ok: true, latencyMs: 120 },
    ping: { ok: true, latencyMs: 45 },
    toolsList: { ok: true, latencyMs: 80 },
  };

  test("re-normalizes the URL on persist", () => {
    const out = toPersistedReport({
      ...baseReport,
      url: "https://u:p@example.com/mcp?secret=1",
    });
    expect(out.url).toBe("https://example.com/mcp");
  });

  test("caps step rawBody at 16 KB with truncation suffix", () => {
    const huge = "x".repeat(20_000);
    const out = toPersistedReport({
      ...baseReport,
      initialize: { ...baseReport.initialize, rawBody: huge },
    });
    expect(out.initialize.rawBody?.length).toBeGreaterThan(16_000);
    expect(out.initialize.rawBody?.length).toBeLessThan(huge.length);
    expect(out.initialize.rawBody?.endsWith("…[truncated]")).toBe(true);
  });

  test("short bodies are passed through unchanged", () => {
    const body = "ok";
    const out = toPersistedReport({
      ...baseReport,
      ping: { ...baseReport.ping, rawBody: body },
    });
    expect(out.ping.rawBody).toBe(body);
  });
});
