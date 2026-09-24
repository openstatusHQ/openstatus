import { beforeEach, describe, expect, test } from "@openstatus/test-utils";

import {
  buildThreadTitle,
  isThreadTitled,
  markThreadTitled,
  truncateTitle,
} from "./thread-title";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

describe("buildThreadTitle", () => {
  test("prefers the drafted report title", () => {
    expect(
      buildThreadTitle({
        draft: {
          toolName: "create_status_report",
          input: { title: "Elevated API error rates", status: "investigating" },
        },
        userText: "<@UBOT> we're seeing errors, open a report",
      }),
    ).toBe("Elevated API error rates");
  });

  test("marks maintenance so it doesn't read as an outage", () => {
    expect(
      buildThreadTitle({
        draft: {
          toolName: "create_maintenance",
          input: { title: "Database upgrade" },
        },
      }),
    ).toBe("Maintenance: Database upgrade");
  });

  test("falls back to the report an update acts on", () => {
    // `add_status_report_update` carries an id, never a title.
    expect(
      buildThreadTitle({
        draft: {
          toolName: "add_status_report_update",
          input: { statusReportId: 42, status: "identified" },
        },
        reportTitle: "Checkout latency in fra",
        userText: "<@UBOT> we found the cause",
      }),
    ).toBe("Checkout latency in fra");
  });

  test("uses what the user asked when the turn writes nothing", () => {
    expect(
      buildThreadTitle({ userText: "<@UBOT>  what's broken right now?  " }),
    ).toBe("what's broken right now?");
  });

  test("gives up rather than inventing a name", () => {
    expect(buildThreadTitle({})).toBeUndefined();
    expect(buildThreadTitle({ userText: "   " })).toBeUndefined();
    expect(buildThreadTitle({ userText: "<@UBOT>" })).toBeUndefined();
    // A draft without a usable title falls through, not onto `[object Object]`.
    expect(
      buildThreadTitle({
        draft: { toolName: "resolve_status_report", input: { title: "  " } },
      }),
    ).toBeUndefined();
  });
});

describe("truncateTitle", () => {
  test("leaves a short title alone and collapses whitespace", () => {
    expect(truncateTitle("  Elevated   API errors\n")).toBe(
      "Elevated API errors",
    );
  });

  test("cuts on a word boundary", () => {
    const long =
      "Elevated error rates affecting checkout and billing across every region";
    const result = truncateTitle(long);
    expect(result.length).toBeLessThanOrEqual(61);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe(
      "Elevated error rates affecting checkout and billing across…",
    );
  });

  test("hard-cuts a single word that runs past the limit", () => {
    const result = truncateTitle("x".repeat(90));
    expect(result).toBe(`${"x".repeat(60)}…`);
  });
});

describe("the titled marker", () => {
  beforeEach(() => redisStore.clear());

  test("is absent until set, then reported for that thread only", async () => {
    expect(await isThreadTitled("D1", "1.1")).toBe(false);

    await markThreadTitled("D1", "1.1");

    expect(await isThreadTitled("D1", "1.1")).toBe(true);
    expect(await isThreadTitled("D1", "2.2")).toBe(false);
    expect(await isThreadTitled("D2", "1.1")).toBe(false);
  });
});
