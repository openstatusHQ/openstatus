import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const verdicts = (sql: string) =>
  sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(count|uniqExactMerge)/.test(line));

// A whole UTC month [monthStart, nextMonthStart) must sum to the daily
// endpoint's days of that month: same view, same quorum, and the view keys
// each run by the UTC day of its cronTimestamp.
describe.each(["http", "tcp", "dns", "icmp", "grpc"])(
  "%s runs range",
  (type) => {
    const daily = read(`endpoints/endpoint__${type}_runs_45d__v0.pipe`);
    const range = read(`endpoints/endpoint__${type}_runs_range__v0.pipe`);
    const view = read(`materializations/aggregate__${type}_runs_45d__v0.pipe`);

    test("reads the daily endpoint's view without a new materialization", () => {
      expect(range).toContain(`FROM mv__${type}_runs_45d__v0\n`);
      expect(daily).toContain(`FROM mv__${type}_runs_45d__v0\n`);
    });

    test("judges each run with the daily endpoint's quorum", () => {
      expect(verdicts(range)).toHaveLength(7);
      expect(verdicts(range)).toEqual(verdicts(daily));
      expect(range).toContain("GROUP BY monitorId, cronTimestamp");
    });

    test("selects runs by cronTimestamp in a half-open range", () => {
      expect(range).toContain("AND cronTimestamp >= fromMs");
      expect(range).toContain("AND cronTimestamp < toMs");
      expect(view).toContain(
        "toStartOfDay(toTimeZone(fromUnixTimestamp64Milli(cronTimestamp), 'UTC')) AS time",
      );
    });
  },
);
