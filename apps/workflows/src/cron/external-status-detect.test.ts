import { FetchError } from "@openstatus/status-fetcher";
import type { DetectionResult } from "@openstatus/status-fetcher";
import { describe, expect, test } from "vitest";

import {
  PROBE_TTL_MS,
  clearProbeStamp,
  decideDetectionAction,
  isBlocked,
  isSuspicious,
  isTransientDbError,
  shouldProbe,
} from "./external-status-detect";

const URL = "https://status.example.com";

const fetchError = (init: {
  kind?: "http" | "parse" | "schema" | "network" | "timeout";
  httpStatus?: number;
}) => new FetchError({ url: URL, ...init });

const result = (partial: Partial<DetectionResult>): DetectionResult => ({
  currentProviderValidated: false,
  matches: [],
  hostnameSuggestions: [],
  evidence: ["e"],
  ...partial,
});

describe("shouldProbe", () => {
  test("probes once per TTL per slug and stamps on true", () => {
    const map = new Map<string, number>();
    expect(shouldProbe("a", 1000, map)).toBe(true);
    expect(shouldProbe("a", 1000 + PROBE_TTL_MS - 1, map)).toBe(false);
    expect(shouldProbe("a", 1000 + PROBE_TTL_MS, map)).toBe(true);
    expect(shouldProbe("b", 1000, map)).toBe(true);
  });

  test("clearProbeStamp refunds the TTL", () => {
    const map = new Map<string, number>();
    expect(shouldProbe("a", 1000, map)).toBe(true);
    clearProbeStamp("a", map);
    expect(shouldProbe("a", 1001, map)).toBe(true);
  });
});

describe("isSuspicious", () => {
  test("parse, schema and 4xx are suspicious", () => {
    expect(isSuspicious(fetchError({ kind: "parse" }))).toBe(true);
    expect(isSuspicious(fetchError({ kind: "schema" }))).toBe(true);
    expect(isSuspicious(fetchError({ kind: "http", httpStatus: 404 }))).toBe(
      true,
    );
  });

  test("bot challenges and rate limits are blocked, not suspicious", () => {
    for (const httpStatus of [401, 403, 429]) {
      const err = fetchError({ kind: "http", httpStatus });
      expect(isBlocked(err)).toBe(true);
      expect(isSuspicious(err)).toBe(false);
    }
    expect(isBlocked(fetchError({ kind: "http", httpStatus: 404 }))).toBe(
      false,
    );
  });

  test("5xx, network, timeout and untyped errors are not", () => {
    expect(isSuspicious(fetchError({ kind: "http", httpStatus: 503 }))).toBe(
      false,
    );
    expect(isSuspicious(fetchError({ kind: "network" }))).toBe(false);
    expect(isSuspicious(fetchError({ kind: "timeout" }))).toBe(false);
    expect(isSuspicious(fetchError({}))).toBe(false);
  });
});

describe("isTransientDbError", () => {
  const upsertError = (cause: Error) => new FetchError({ url: URL, cause });

  test("busy, locked and Turso 5xx upsert failures are transient", () => {
    expect(
      isTransientDbError(upsertError(new Error("database is locked"))),
    ).toBe(true);
    expect(
      isTransientDbError(
        upsertError(new Error("Server returned HTTP status 502")),
      ),
    ).toBe(true);
  });

  test("a stalled Turso connection is transient", () => {
    const stalled = new Error("Failed query: select ...", {
      cause: new TypeError("fetch failed", {
        cause: new Error('HTTP/2: "headers timeout after 300000"'),
      }),
    });
    expect(isTransientDbError(upsertError(stalled))).toBe(true);
  });

  test("permanent upsert failures are not", () => {
    expect(
      isTransientDbError(
        upsertError(new Error("UNIQUE constraint failed: slug")),
      ),
    ).toBe(false);
  });

  test("upstream fetch failures are not", () => {
    expect(
      isTransientDbError(fetchError({ kind: "http", httpStatus: 503 })),
    ).toBe(false);
    expect(
      isTransientDbError(
        new FetchError({
          url: URL,
          kind: "network",
          cause: new TypeError("fetch failed"),
        }),
      ),
    ).toBe(false);
  });
});

describe("decideDetectionAction", () => {
  const row = (apiConfig: { type: "atlassian"; endpoint?: string } | null) =>
    ({ provider: "atlassian-statuspage", apiConfig }) as const;

  test("clears config when current validates and a custom endpoint is set", () => {
    const action = decideDetectionAction(
      result({ currentProviderValidated: true }),
      row({ type: "atlassian", endpoint: "https://stale.example.com" }),
    );
    expect(action.kind).toBe("clear-config");
  });

  test("noop transient when current validates with default endpoint", () => {
    const action = decideDetectionAction(
      result({ currentProviderValidated: true }),
      row(null),
    );
    expect(action).toMatchObject({ kind: "noop", reason: "transient" });
  });

  test("applies a single match", () => {
    const action = decideDetectionAction(
      result({
        matches: [{ type: "instatus", provider: "instatus", endpoint: URL }],
      }),
      row(null),
    );
    expect(action).toMatchObject({ kind: "apply", provider: "instatus" });
  });

  test("suggests when multiple matches", () => {
    const action = decideDetectionAction(
      result({
        matches: [
          { type: "incidentio", provider: "incidentio", endpoint: URL },
          {
            type: "atlassian",
            provider: "atlassian-statuspage",
            endpoint: URL,
          },
        ],
      }),
      row(null),
    );
    expect(action).toMatchObject({
      kind: "suggest",
      suggestion: "atlassian-statuspage|incidentio",
    });
  });

  test("suggests the new base when the page moved", () => {
    const action = decideDetectionAction(
      result({
        movedTo: {
          base: "https://example.status.atlassian.com",
          matches: [
            {
              type: "atlassian",
              provider: "atlassian-statuspage",
              endpoint:
                "https://example.status.atlassian.com/api/v2/summary.json",
            },
          ],
        },
        hostnameSuggestions: ["uptime-robot"],
      }),
      row(null),
    );
    expect(action).toMatchObject({
      kind: "suggest",
      suggestion:
        "atlassian-statuspage at https://example.status.atlassian.com",
    });
  });

  test("suggests hostname evidence", () => {
    const action = decideDetectionAction(
      result({ hostnameSuggestions: ["uptime-robot"] }),
      row(null),
    );
    expect(action).toMatchObject({
      kind: "suggest",
      suggestion: "uptime-robot",
    });
  });

  test("noop no-evidence when nothing found", () => {
    const action = decideDetectionAction(result({}), row(null));
    expect(action).toMatchObject({ kind: "noop", reason: "no-evidence" });
  });
});
