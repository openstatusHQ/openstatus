import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";

import {
  formatDateForInput,
  formatDateRange,
  formatDistanceToNowShort,
  formatMilliseconds,
  formatNumber,
  formatPercentage,
} from "./formatter";

describe("formatMilliseconds", () => {
  it("keeps milliseconds up to one second", () => {
    expect(formatMilliseconds(250)).toBe("250 ms");
    expect(formatMilliseconds(1000)).toBe("1,000 ms");
  });

  it("switches to seconds above one second", () => {
    expect(formatMilliseconds(1500)).toBe("1.5 sec");
    expect(formatMilliseconds(12_345)).toBe("12.35 sec");
  });
});

describe("formatPercentage", () => {
  it("uses two fraction digits by default", () => {
    expect(formatPercentage(0.99951)).toBe("99.95%");
    expect(formatPercentage(1)).toBe("100.00%");
  });

  it("honours a custom precision", () => {
    expect(formatPercentage(0.5, 0)).toBe("50%");
  });

  it("treats NaN as full uptime", () => {
    expect(formatPercentage(Number.NaN)).toBe("100%");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("formatDateRange", () => {
  it("returns 'All time' without bounds", () => {
    expect(formatDateRange()).toBe("All time");
  });

  it("describes open-ended ranges", () => {
    const date = new Date(2024, 0, 15, 9, 5);
    expect(formatDateRange(date)).toMatch(/^Since January 15/);
    expect(formatDateRange(undefined, date)).toMatch(/^Until January 15/);
  });

  it("shows only the end time for a same-day range", () => {
    const range = formatDateRange(
      new Date(2024, 0, 15, 9, 5),
      new Date(2024, 0, 15, 17, 30),
    );
    expect(range).toMatch(/^January 15.* - 5:30\sPM$/);
  });

  it("shows only dates for whole-day ranges", () => {
    expect(
      formatDateRange(
        new Date(2024, 0, 1),
        new Date(2024, 0, 31, 23, 59, 59, 999),
      ),
    ).toBe("January 1, 2024 - January 31, 2024");
  });

  it("shows date and time for partial-day ranges", () => {
    const range = formatDateRange(
      new Date(2024, 0, 1, 8, 0),
      new Date(2024, 0, 3, 18, 0),
    );
    expect(range).toMatch(/^January 1.*8:00\sAM - January 3.*6:00\sPM$/);
  });
});

describe("formatDistanceToNowShort", () => {
  const now = new Date("2024-06-01T12:00:00Z");

  for (const [secondsAgo, expected] of [
    [0, "0s ago"],
    [59, "59s ago"],
    [60, "1m ago"],
    [59 * 60, "59m ago"],
    [60 * 60, "1h ago"],
    [23 * 60 * 60, "23h ago"],
    [24 * 60 * 60, "1d ago"],
    [10 * 24 * 60 * 60, "10d ago"],
  ] as const) {
    it(`${secondsAgo}s -> ${expected}`, () => {
      const time = new FakeTime(now);
      try {
        const date = new Date(now.getTime() - secondsAgo * 1000);
        expect(formatDistanceToNowShort(date)).toBe(expected);
      } finally {
        time.restore();
      }
    });
  }

  it("clamps future dates to 0s", () => {
    const time = new FakeTime(now);
    try {
      expect(formatDistanceToNowShort(new Date(now.getTime() + 60_000))).toBe(
        "0s ago",
      );
    } finally {
      time.restore();
    }
  });
});

describe("formatDateForInput", () => {
  it("formats a local datetime-local value with zero padding", () => {
    expect(formatDateForInput(new Date(2024, 2, 5, 7, 4))).toBe(
      "2024-03-05T07:04",
    );
  });
});
