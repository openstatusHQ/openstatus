import { FetchError } from "@openstatus/status-fetcher";
import type { DetectionResult } from "@openstatus/status-fetcher";
import { describe, expect, test } from "@openstatus/test-utils";

import {
  PROBE_TTL_MS,
  clearProbeStamp,
  decideDetectionAction,
  isSuspicious,
  shouldProbe,
} from "./external-status-detect";

const URL = "https://status.example.com";

const fetchError = (init: {
  kind?: "http" | "parse" | "network" | "timeout";
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
  test("parse and 4xx are suspicious", () => {
    expect(isSuspicious(fetchError({ kind: "parse" }))).toBe(true);
    expect(isSuspicious(fetchError({ kind: "http", httpStatus: 404 }))).toBe(
      true,
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
