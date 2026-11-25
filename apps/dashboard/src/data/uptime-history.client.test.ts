import { describe, expect, it } from "vitest";

import { exampleUptimeCounts } from "./uptime-history.client";

const now = new Date(Date.UTC(2026, 10, 4, 12)); // Wednesday

describe("exampleUptimeCounts", () => {
  it("is stable and spans from last January to today", () => {
    const counts = exampleUptimeCounts(now);
    expect(exampleUptimeCounts(now)).toEqual(counts);
    expect(counts[0].day).toBe("2025-01-01");
    expect(counts.at(-1)?.day).toBe("2026-11-04");
    for (const c of counts) {
      expect(c.ok + c.degraded + c.error).toBe(1440);
    }
  });
});
