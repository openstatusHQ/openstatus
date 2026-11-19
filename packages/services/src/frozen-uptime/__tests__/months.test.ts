import { describe, expect, test } from "vitest";

import {
  canonicalTimeZone,
  monthOf,
  monthsBetween,
  splitByMonth,
} from "../months";

describe("monthOf", () => {
  test("23:30 UTC on the last day of a month is the next month in Berlin", () => {
    const at = Date.UTC(2026, 0, 31, 23, 30);
    expect(monthOf(at)).toBe("2026-01-01");
    expect(monthOf(at, "Europe/Berlin")).toBe("2026-02-01");
  });
});

describe("monthsBetween", () => {
  test("lists months oldest first across a year edge", () => {
    expect(monthsBetween("2025-11", "2026-02-01")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(monthsBetween("2026-03", "2026-02")).toEqual([]);
  });
});

describe("splitByMonth", () => {
  test("cuts at UTC month boundaries", () => {
    const from = Date.UTC(2026, 0, 31, 20);
    const to = Date.UTC(2026, 1, 1, 2);
    expect(splitByMonth(from, to)).toEqual([
      { month: "2026-01-01", start: from, end: Date.UTC(2026, 1, 1) },
      { month: "2026-02-01", start: Date.UTC(2026, 1, 1), end: to },
    ]);
  });
});

describe("canonicalTimeZone", () => {
  test("folds UTC aliases and rejects unknown zones and raw offsets", () => {
    expect(canonicalTimeZone("Etc/UTC")).toBe("UTC");
    expect(canonicalTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
    expect(canonicalTimeZone("Mars/Base")).toBeNull();
    expect(canonicalTimeZone("+02:00")).toBeNull();
    expect(canonicalTimeZone("")).toBeNull();
  });
});
