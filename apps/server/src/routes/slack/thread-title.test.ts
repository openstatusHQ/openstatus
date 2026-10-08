import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
import type { WebClient } from "@slack/web-api";

import {
  buildThreadTitle,
  isThreadTitled,
  markThreadTitled,
  renameThread,
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
    expect(await isThreadTitled("T1", "D1", "1.1")).toBe(false);

    await markThreadTitled("T1", "D1", "1.1");

    expect(await isThreadTitled("T1", "D1", "1.1")).toBe(true);
    expect(await isThreadTitled("T1", "D1", "2.2")).toBe(false);
    expect(await isThreadTitled("T1", "D2", "1.1")).toBe(false);
    // Two installs sharing a channel id don't share a title.
    expect(await isThreadTitled("T2", "D1", "1.1")).toBe(false);
  });
});

describe("renameThread", () => {
  beforeEach(() => redisStore.clear());

  function slackStub(rename: () => Promise<unknown>) {
    const calls: Array<Record<string, unknown>> = [];
    const slack = {
      agents: {
        sessions: {
          rename: (args: Record<string, unknown>) => {
            calls.push(args);
            return rename();
          },
        },
      },
    } as unknown as WebClient;
    return { slack, calls };
  }

  const args = { channel: "D1", threadTs: "1.1", title: "Up", teamId: "T1" };

  test("marks the thread titled once Slack accepts the rename", async () => {
    const { slack, calls } = slackStub(() => Promise.resolve({ ok: true }));

    await renameThread({ slack, ...args });

    expect(calls).toEqual([
      { channel_id: "D1", thread_ts: "1.1", title: "Up" },
    ]);
    expect(await isThreadTitled("T1", "D1", "1.1")).toBe(true);
  });

  test("leaves the thread eligible when Slack refuses", async () => {
    const { slack } = slackStub(() =>
      Promise.reject(new Error("feature_disabled")),
    );

    await renameThread({ slack, ...args });

    expect(await isThreadTitled("T1", "D1", "1.1")).toBe(false);
  });

  test("renames once when two turns race", async () => {
    const { slack, calls } = slackStub(() => Promise.resolve({ ok: true }));

    await Promise.all([
      renameThread({ slack, ...args }),
      renameThread({ slack, ...args, title: "Down" }),
    ]);

    expect(calls.length).toBe(1);
  });
});
