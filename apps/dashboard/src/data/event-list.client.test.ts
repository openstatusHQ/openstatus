import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { groupByMonth, listNames, pluralize } from "./event-list.client";

// mid-month dates keep the local-time bucketing independent of the runner's TZ
const item = (id: number, iso: string) => ({ id, date: new Date(iso) });

describe("groupByMonth", () => {
  it("buckets by month and keeps the input order", () => {
    const groups = groupByMonth(
      [
        item(1, "2026-10-14T12:00:00Z"),
        item(2, "2026-10-10T12:00:00Z"),
        item(3, "2026-09-15T12:00:00Z"),
        item(4, "2025-09-15T12:00:00Z"),
      ],
      (i) => i.date,
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-10", "2026-09", "2025-09"]);
    expect(groups.map((g) => g.label)).toEqual([
      "October 2026",
      "September 2026",
      "September 2025",
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("returns no groups for no items", () => {
    expect(groupByMonth([], () => new Date())).toEqual([]);
  });
});

describe("pluralize", () => {
  it("keeps a count of 1 singular", () => {
    expect(pluralize(1, "update")).toBe("1 update");
    expect(pluralize(0, "update")).toBe("0 updates");
    expect(pluralize(3, "downtime")).toBe("3 downtimes");
  });
});

describe("listNames", () => {
  it("collapses names past the max into a count", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["API", "Website"])).toBe("API, Website");
    expect(listNames(["API", "Website", "Docs", "Blog"])).toBe(
      "API, Website +2",
    );
  });
});
