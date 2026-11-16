import { describe, expect, test } from "vitest";

import { formatSlaUptime } from "./constants";

describe("formatSlaUptime", () => {
  test.each([
    [99_450, "99.450"],
    [100_000, "100.000"],
    [99_499, "99.499"],
    [5, "0.005"],
  ])("%i reads %s", (uptime, expected) => {
    expect(formatSlaUptime(uptime)).toBe(expected);
  });
});
