import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { validateMeta } from "./meta.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tutorials = readdirSync(dir).filter((f) => f.endsWith(".mjs"));

const valid = {
  order: 1,
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
    expect(problems).toHaveLength(3);
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
