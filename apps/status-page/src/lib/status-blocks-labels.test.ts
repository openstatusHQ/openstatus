import { describe, expect, test } from "bun:test";

import { defaultStatusBlocksLabels as labels } from "@openstatus/ui/components/blocks/status.utils";

// Status-page timestamps render in UTC, so the user-facing labels carry a
// trailing "(UTC)" to tell viewers which zone they are reading (see #2302).
describe("defaultStatusBlocksLabels UTC suffix", () => {
  const date = new Date("2024-01-15T14:30:00Z");

  test("formatDate appends the UTC suffix", () => {
    expect(labels.formatDate(date)).toBe("January 15, 2024 (UTC)");
  });

  test("formatDateShort appends the UTC suffix", () => {
    expect(labels.formatDateShort(date)).toBe("Jan 15, 2024 (UTC)");
  });

  test("formatDateTime appends the UTC suffix", () => {
    expect(labels.formatDateTime(date)).toBe("January 15 at 2:30 PM (UTC)");
  });

  describe("formatDateRange", () => {
    test("appends a single UTC suffix to the whole range", () => {
      expect(
        labels.formatDateRange(
          new Date("2024-01-15T10:00:00Z"),
          new Date("2024-01-15T15:00:00Z"),
        ),
      ).toBe("January 15 at 10:00 AM - 3:00 PM (UTC)");
    });

    test("appends the UTC suffix to an open-ended range", () => {
      expect(
        labels.formatDateRange(new Date("2024-01-15T10:00:00Z"), undefined),
      ).toBe("Since January 15 at 10:00 AM (UTC)");
    });

    test("appends the UTC suffix to an open-start range", () => {
      expect(
        labels.formatDateRange(undefined, new Date("2024-01-15T15:00:00Z")),
      ).toBe("Until January 15 at 3:00 PM (UTC)");
    });

    test("leaves `All time` without a UTC suffix", () => {
      expect(labels.formatDateRange()).toBe("All time");
    });
  });

  test("formatDateRangeParts marks only the trailing `to` part", () => {
    expect(
      labels.formatDateRangeParts(
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T15:00:00Z"),
      ),
    ).toEqual({ from: "January 15 at 10:00 AM", to: "3:00 PM (UTC)" });
  });
});
