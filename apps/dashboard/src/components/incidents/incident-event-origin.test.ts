import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { eventOrigin } from "./incident-event-origin";

const PERMALINK = "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1700";
const LEGACY = `Rolling back the deploy.\n\n[From Slack](${PERMALINK})`;

describe("eventOrigin", () => {
  it("reads a legacy note's suffix as the Slack origin and strips it", () => {
    expect(
      eventOrigin({
        type: "note",
        source: null,
        sourceRef: null,
        message: LEGACY,
      }),
    ).toEqual({
      origin: { kind: "slack", href: PERMALINK },
      message: "Rolling back the deploy.",
    });
  });

  it("reads source and source_ref on a new note", () => {
    expect(
      eventOrigin({
        type: "note",
        source: "slack",
        sourceRef: PERMALINK,
        message: "Rolling back the deploy.",
      }),
    ).toEqual({
      origin: { kind: "slack", href: PERMALINK },
      message: "Rolling back the deploy.",
    });
  });

  it("prefers source_ref when a note carries both", () => {
    const { origin, message } = eventOrigin({
      type: "note",
      source: "slack",
      sourceRef: "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1800",
      message: LEGACY,
    });
    expect(origin?.href).toBe(
      "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1800",
    );
    expect(message).toBe("Rolling back the deploy.");
  });

  it("falls back to the suffix on an unbackfilled Slack row", () => {
    expect(
      eventOrigin({
        type: "note",
        source: "slack",
        sourceRef: null,
        message: LEGACY,
      }).origin,
    ).toEqual({ kind: "slack", href: PERMALINK });
  });

  it("keeps a Slack origin without a link", () => {
    expect(
      eventOrigin({
        type: "commander_changed",
        source: "slack",
        sourceRef: null,
        message: "Commander set to Maximilian Kaske",
      }).origin,
    ).toEqual({ kind: "slack", href: undefined });
  });

  it("only reads the suffix on notes", () => {
    const { origin, message } = eventOrigin({
      type: "status_changed",
      source: null,
      sourceRef: null,
      message: LEGACY,
    });
    expect(origin).toBeUndefined();
    expect(message).toBe(LEGACY);
  });

  it("maps api and mcp without a link", () => {
    for (const source of ["api", "mcp"] as const) {
      expect(
        eventOrigin({ type: "note", source, sourceRef: "key_1", message: "x" })
          .origin,
      ).toEqual({ kind: source });
    }
  });

  it("has no origin for dashboard, agent and system rows", () => {
    for (const source of ["dashboard", "agent", "system", null] as const) {
      expect(
        eventOrigin({ type: "note", source, sourceRef: null, message: "x" })
          .origin,
      ).toBeUndefined();
    }
  });

  it("keeps the suffix text on a note written outside Slack", () => {
    expect(
      eventOrigin({
        type: "note",
        source: "dashboard",
        sourceRef: null,
        message: LEGACY,
      }),
    ).toEqual({ origin: undefined, message: LEGACY });
  });
});
