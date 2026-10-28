import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { validateMeta } from "./meta.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tutorials = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
// Terminal casts (scripts/record-terminal.mjs) and Slack threads
// (scripts/record-slack.mjs) share the meta contract.
const castsDir = join(dir, "..", "casts");
const casts = readdirSync(castsDir).filter((f) => f.endsWith(".mjs"));
const threadsDir = join(dir, "..", "slack", "threads");
const threads = readdirSync(threadsDir).filter((f) => f.endsWith(".mjs"));

const valid = {
  order: 1,
  label: "Launch",
  title: "Title",
  subtitle: "Subtitle",
  outroTitle: "Done.",
  outroSubtitle: "Next: more.",
};

describe("validateMeta", () => {
  test("accepts a complete meta", () => {
    expect(validateMeta(valid, "t")).toEqual([]);
  });

  test("names every missing field and unknown requirement", () => {
    const problems = validateMeta(
      { ...valid, order: 0, title: " ", requires: ["database"] },
      "t",
    );
    expect(problems).toEqual([
      "t: meta.order must be a positive integer",
      "t: meta.title must be a non-empty string",
      't: unknown requirement "database"',
    ]);
  });

  test("wants the label as one word", () => {
    expect(validateMeta({ ...valid, label: "" }, "t")).toEqual([
      "t: meta.label must be a non-empty string",
    ]);
    expect(validateMeta({ ...valid, label: "Set up" }, "t")).toEqual([
      "t: meta.label must be one word",
    ]);
  });

  test("checks thumbnail copy only when set", () => {
    expect(validateMeta({ ...valid, thumbTitle: "Short." }, "t")).toEqual([]);
    expect(
      validateMeta({ ...valid, thumbEyebrow: " ", thumbSubtitle: "" }, "t"),
    ).toEqual([
      "t: meta.thumbEyebrow must be a non-empty string if set",
      "t: meta.thumbSubtitle must be a non-empty string if set",
    ]);
  });

  test("checks a viewport only when set", () => {
    const viewport = { width: 1120, height: 900 };
    expect(validateMeta({ ...valid, viewport }, "t")).toEqual([]);
    expect(validateMeta({ ...valid, viewport: { width: 1120 } }, "t")).toEqual([
      "t: meta.viewport needs a positive integer width and height",
    ]);
  });

  test("reports a requires that is not a list", () => {
    expect(validateMeta({ ...valid, requires: {} }, "t")).toEqual([
      "t: meta.requires must be an array",
    ]);
  });
});

// Tutorials and casts are each a series: valid metas, one order per video.
for (const [name, from, files] of [
  ["tutorial", dir, tutorials],
  ["cast", castsDir, casts],
]) {
  describe(`${name}s`, () => {
    test(`every ${name} exports a valid meta`, async () => {
      for (const file of files) {
        const { meta } = await import(join(from, file));
        expect(validateMeta(meta, file)).toEqual([]);
      }
    });

    test("series order is unique", async () => {
      const orders = await Promise.all(
        files.map(async (f) => (await import(join(from, f))).meta.order),
      );
      expect(new Set(orders).size).toBe(orders.length);
    });
  });
}

describe("slack threads", () => {
  test("every thread exports a valid meta and a cast to play", async () => {
    for (const file of threads) {
      const thread = await import(join(threadsDir, file));
      expect(validateMeta(thread.meta, file)).toEqual([]);
      expect(thread.default).toBeTypeOf("function");
      expect(thread.model).toBeDefined();
      expect(thread.people.length).toBeGreaterThan(0);
      expect(thread.channels.length).toBeGreaterThan(0);
    }
  });

  test("a thread cut with the dashboard has its own valid copy", async () => {
    for (const file of threads) {
      const thread = await import(join(threadsDir, file));
      if (thread.dashboardMeta === undefined) continue;
      expect(validateMeta(thread.dashboardMeta, file)).toEqual([]);
      expect(thread.dashboardMeta.title).not.toBe(thread.meta.title);
    }
  });
});
