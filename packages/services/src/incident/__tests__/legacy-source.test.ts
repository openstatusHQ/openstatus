import { describe, expect, test } from "vitest";

import { withLegacySource } from "../legacy-source";

const PERMALINK = "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1700";
const LEGACY = `Rolling back the deploy.\n\n[From Slack](${PERMALINK})`;

describe("withLegacySource", () => {
  test("lifts a legacy note's suffix into the columns and strips it", () => {
    expect(
      withLegacySource({
        type: "note",
        source: null,
        sourceRef: null,
        message: LEGACY,
      }),
    ).toEqual({
      type: "note",
      source: "slack",
      sourceRef: PERMALINK,
      message: "Rolling back the deploy.",
    });
  });

  test("leaves a new note alone", () => {
    const event = {
      type: "note",
      source: "slack",
      sourceRef: PERMALINK,
      message: "Rolling back the deploy.",
    };
    expect(withLegacySource(event)).toBe(event);
  });

  test("prefers source_ref when a note carries both", () => {
    const other = "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1800";
    expect(
      withLegacySource({
        type: "note",
        source: "slack",
        sourceRef: other,
        message: LEGACY,
      }),
    ).toEqual({
      type: "note",
      source: "slack",
      sourceRef: other,
      message: "Rolling back the deploy.",
    });
  });

  test("links an unbackfilled Slack row from its suffix", () => {
    expect(
      withLegacySource({
        type: "note",
        source: "slack",
        sourceRef: null,
        message: LEGACY,
      }).sourceRef,
    ).toBe(PERMALINK);
  });

  test("only reads the suffix on notes", () => {
    const event = {
      type: "status_changed",
      source: null,
      sourceRef: null,
      message: LEGACY,
    };
    expect(withLegacySource(event)).toBe(event);
  });

  test("never rewrites a row from another source", () => {
    const event = {
      type: "note",
      source: "api",
      sourceRef: "key",
      message: LEGACY,
    };
    expect(withLegacySource(event)).toBe(event);
  });

  test("keeps extra fields", () => {
    const event = {
      id: 7,
      type: "note",
      source: null,
      sourceRef: null,
      message: LEGACY,
      createdBy: 2,
    };
    expect(withLegacySource(event)).toMatchObject({ id: 7, createdBy: 2 });
  });
});
