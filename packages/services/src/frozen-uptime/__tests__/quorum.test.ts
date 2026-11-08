import { describe, expect, test } from "vitest";

import { tallyDay } from "../../status-timeline";
import {
  type QuorumHistogramRow,
  quorumByDay,
  quorumPopulation,
} from "../quorum";

function row(overrides: Partial<QuorumHistogramRow>): QuorumHistogramRow {
  return {
    monitorId: "1",
    day: "2026-11-02 00:00:00",
    private: false,
    errorRegions: 0,
    notOkRegions: 0,
    runs: 1,
    ...overrides,
  };
}

describe("quorumPopulation", () => {
  test("cloud regions decide when the monitor has any", () => {
    expect(quorumPopulation("ams,fra,iad")).toEqual({
      private: false,
      regionCount: 3,
    });
  });

  test("a region listed twice counts once", () => {
    expect(quorumPopulation("ams,fra,ams, fra,iad")).toEqual({
      private: false,
      regionCount: 3,
    });
  });

  test("private-only monitors get no population", () => {
    expect(quorumPopulation("")).toBeNull();
    expect(quorumPopulation(" , ")).toBeNull();
  });
});

describe("quorumByDay", () => {
  const cloud = { private: false, regionCount: 6 };

  test("keeps only the population's scope", () => {
    const days = quorumByDay(
      [
        row({ errorRegions: 1, notOkRegions: 1, runs: 144 }),
        row({ private: true, errorRegions: 1, notOkRegions: 1, runs: 144 }),
      ],
      cloud,
    );
    expect(days.get("2026-11-02")).toEqual({
      regionCount: 6,
      buckets: [{ errorRegions: 1, notOkRegions: 1, runs: 144 }],
    });
  });

  test("sums runs of identical buckets and splits days", () => {
    const days = quorumByDay(
      [
        row({ errorRegions: 3, notOkRegions: 3, runs: 2 }),
        row({ errorRegions: 3, notOkRegions: 3, runs: 5 }),
        row({ errorRegions: 3, notOkRegions: 4, runs: 1 }),
        row({ day: "2026-11-03T00:00:00.000Z", runs: 9 }),
      ],
      cloud,
    );
    expect(days.get("2026-11-02")?.buckets).toEqual([
      { errorRegions: 3, notOkRegions: 3, runs: 7 },
      { errorRegions: 3, notOkRegions: 4, runs: 1 },
    ]);
    expect(days.get("2026-11-03")?.buckets).toEqual([
      { errorRegions: 0, notOkRegions: 0, runs: 9 },
    ]);
  });

  test("no rows in scope or no configured regions → no quorum", () => {
    expect(quorumByDay([], cloud).size).toBe(0);
    expect(quorumByDay([row({ private: true })], cloud).size).toBe(0);
    expect(quorumByDay([row({})], { private: true, regionCount: 0 }).size).toBe(
      0,
    );
  });

  test("tallied, 1 of 6 failing stays up and 3 of 6 failing is down", () => {
    const days = quorumByDay(
      [
        row({ errorRegions: 1, notOkRegions: 1, runs: 100 }),
        row({ errorRegions: 3, notOkRegions: 3, runs: 4 }),
        row({ errorRegions: 0, notOkRegions: 3, runs: 2 }),
      ],
      cloud,
    );
    const quorum = days.get("2026-11-02");
    expect(tallyDay({ ok: 0, degraded: 0, error: 0, quorum }, 6)).toMatchObject(
      {
        up: 102,
        total: 106,
        ok: 100,
        degraded: 2,
        error: 4,
      },
    );
  });
});
