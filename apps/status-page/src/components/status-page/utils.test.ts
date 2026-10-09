import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  type ChartData,
  getHighestPriorityStatus,
  getHighestStatus,
  getPercentagePriorityStatus,
} from "./utils";

function day(
  counts: Partial<Pick<ChartData, "success" | "degraded" | "error" | "info">>,
): ChartData {
  return {
    timestamp: 0,
    success: 0,
    degraded: 0,
    error: 0,
    info: 0,
    ...counts,
  };
}

describe("getHighestPriorityStatus", () => {
  it("returns empty for a day without data", () => {
    expect(getHighestPriorityStatus(day({}))).toBe("empty");
  });

  it("ranks error over degraded over info over success", () => {
    expect(
      getHighestPriorityStatus(
        day({ success: 1, info: 1, degraded: 1, error: 1 }),
      ),
    ).toBe("error");
    expect(
      getHighestPriorityStatus(day({ success: 1, info: 1, degraded: 1 })),
    ).toBe("degraded");
    expect(getHighestPriorityStatus(day({ success: 1, info: 1 }))).toBe("info");
    expect(getHighestPriorityStatus(day({ success: 1 }))).toBe("success");
  });

  it("lets a single error minute outrank a full day of success", () => {
    expect(getHighestPriorityStatus(day({ success: 1439, error: 1 }))).toBe(
      "error",
    );
  });
});

describe("getPercentagePriorityStatus", () => {
  it("returns empty for a day without data", () => {
    expect(getPercentagePriorityStatus(day({}))).toBe("empty");
  });

  it("applies the 95% and 75% success thresholds", () => {
    expect(getPercentagePriorityStatus(day({ success: 95, error: 5 }))).toBe(
      "success",
    );
    expect(getPercentagePriorityStatus(day({ success: 94, error: 6 }))).toBe(
      "degraded",
    );
    expect(getPercentagePriorityStatus(day({ success: 75, error: 25 }))).toBe(
      "degraded",
    );
    expect(getPercentagePriorityStatus(day({ success: 74, error: 26 }))).toBe(
      "error",
    );
  });

  it("treats a day with no successful checks as error", () => {
    expect(getPercentagePriorityStatus(day({ error: 10 }))).toBe("error");
    expect(getPercentagePriorityStatus(day({ info: 10 }))).toBe("error");
  });
});

describe("getHighestStatus", () => {
  it("picks the most severe status", () => {
    expect(getHighestStatus(["success", "info", "degraded", "error"])).toBe(
      "error",
    );
    expect(getHighestStatus(["success", "info", "degraded"])).toBe("degraded");
    expect(getHighestStatus(["success", "info"])).toBe("info");
    expect(getHighestStatus(["success"])).toBe("success");
  });

  it("defaults to success for an empty list", () => {
    expect(getHighestStatus([])).toBe("success");
  });
});
