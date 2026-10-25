import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { validateMeta } from "./meta.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tutorials = readdirSync(dir).filter((f) => f.endsWith(".mjs"));

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
    expect(validateMeta({ ...valid, thumbSubtitle: "" }, "t")).toEqual([
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

describe("tutorials", () => {
  test("every tutorial exports a valid meta", async () => {
    for (const file of tutorials) {
      const { meta } = await import(join(dir, file));
      expect(validateMeta(meta, file)).toEqual([]);
    }
  });

  test("series order is unique", async () => {
    const orders = await Promise.all(
      tutorials.map(async (f) => (await import(join(dir, f))).meta.order),
    );
    expect(new Set(orders).size).toBe(orders.length);
  });
});
