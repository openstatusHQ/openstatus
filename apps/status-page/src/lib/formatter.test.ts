import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  formatDate,
  formatDateRange,
  formatDateRangeParts,
  formatDateTime,
  formatTime,
} from "./formatter";

// Timestamps must render in UTC so every viewer sees the authored time,
// independent of their local timezone (see #2302).
describe("formatter UTC rendering", () => {
  describe("formatDate", () => {
    test("renders the UTC day with a long month", () => {
      expect(formatDate(new Date("2024-01-15T14:30:00Z"))).toBe(
        "January 15, 2024",
      );
    });

    test("honors a short month override", () => {
      expect(
        formatDate(new Date("2024-01-15T14:30:00Z"), { month: "short" }),
      ).toBe("Jan 15, 2024");
    });

    test("keeps a late-UTC timestamp on its UTC day", () => {
      expect(formatDate(new Date("2024-01-15T23:30:00Z"))).toBe(
        "January 15, 2024",
      );
    });

    test("ignores a caller attempt to override the timezone", () => {
      // 01:00 UTC is still Jan 14 in New York, so a leaked override would read "January 14".
      expect(
        formatDate(new Date("2024-01-15T01:00:00Z"), {
          timeZone: "America/New_York",
        }),
      ).toBe("January 15, 2024");
    });
  });

  describe("formatDateTime", () => {
    test("renders the UTC wall-clock time", () => {
      expect(formatDateTime(new Date("2024-01-15T14:30:00Z"))).toBe(
        "January 15 at 2:30 PM",
      );
    });
  });

  describe("formatTime", () => {
    test("renders the UTC wall-clock time", () => {
      expect(formatTime(new Date("2024-01-15T14:30:00Z"))).toBe("2:30 PM");
    });

    test("does not shift a late-UTC time into the next day's hours", () => {
      expect(formatTime(new Date("2024-01-15T23:30:00Z"))).toBe("11:30 PM");
    });
  });
});

describe("formatDateRange", () => {
  test("collapses the `to` side to a time when both fall on the same UTC day", () => {
    expect(
      formatDateRange(
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T15:00:00Z"),
      ),
    ).toBe("January 15 at 10:00 AM - 3:00 PM");
  });

  test("renders date-only when the range spans whole UTC days", () => {
    expect(
      formatDateRange(
        new Date("2024-01-15T00:00:00.000Z"),
        new Date("2024-01-17T23:59:59.999Z"),
      ),
    ).toBe("January 15, 2024 - January 17, 2024");
  });

  test("keeps both timestamps for a partial multi-day range", () => {
    expect(
      formatDateRange(
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-17T12:00:00Z"),
      ),
    ).toBe("January 15 at 10:00 AM - January 17 at 12:00 PM");
  });

  test("renders a single timestamp when from and to are equal", () => {
    const date = new Date("2024-01-15T10:00:00Z");
    expect(formatDateRange(date, date)).toBe("January 15 at 10:00 AM");
  });

  test("renders `Until` for an open-start range", () => {
    expect(formatDateRange(undefined, new Date("2024-01-15T15:00:00Z"))).toBe(
      "Until January 15 at 3:00 PM",
    );
  });

  test("renders `Since` for an open-end range", () => {
    expect(formatDateRange(new Date("2024-01-15T10:00:00Z"), undefined)).toBe(
      "Since January 15 at 10:00 AM",
    );
  });

  test("renders `All time` when no bounds are given", () => {
    expect(formatDateRange()).toBe("All time");
  });
});

describe("formatDateRangeParts", () => {
  test("collapses the `to` side to a time on the same UTC day", () => {
    expect(
      formatDateRangeParts(
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T15:00:00Z"),
      ),
    ).toEqual({ from: "January 15 at 10:00 AM", to: "3:00 PM" });
  });

  test("renders date-only parts for whole UTC days", () => {
    expect(
      formatDateRangeParts(
        new Date("2024-01-15T00:00:00.000Z"),
        new Date("2024-01-17T23:59:59.999Z"),
      ),
    ).toEqual({ from: "January 15, 2024", to: "January 17, 2024" });
  });

  test("keeps both timestamps for a partial multi-day range", () => {
    expect(
      formatDateRangeParts(
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-17T12:00:00Z"),
      ),
    ).toEqual({
      from: "January 15 at 10:00 AM",
      to: "January 17 at 12:00 PM",
    });
  });
});
