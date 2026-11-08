import { describe, expect, test } from "vitest";

import { tallyDay } from "../../status-timeline";
import { attachQuorum, fetchLiveQuorum } from "../live";
import type { QuorumHistogramRow } from "../quorum";
import type { QuorumPipeFn, UptimeQuorumPipes } from "../run";

type Call = { monitorIds: string[]; timezone?: string };

function pipes(
  impl: (params: Call) => Promise<{ data: QuorumHistogramRow[] }>,
): { pipes: UptimeQuorumPipes; calls: Call[] } {
  const calls: Call[] = [];
  const pipe: QuorumPipeFn = (params) => {
    calls.push(params);
    return impl(params);
  };
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

function hist(overrides: Partial<QuorumHistogramRow>): QuorumHistogramRow {
  return {
    monitorId: "1",
    day: "2026-11-02T00:00:00.000Z",
    private: false,
    errorRegions: 0,
    notOkRegions: 0,
    runs: 1,
    ...overrides,
  };
}

const sixRegions = "ams,fra,iad,gru,syd,hkg";
const sleep = async () => {};

describe("fetchLiveQuorum", () => {
  test("a UTC read sends the freeze's request shape, without a timezone", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({ data: [] }));
    for (const timeZone of [undefined, "UTC"]) {
      await fetchLiveQuorum({
        monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
        quorumPipes,
        timeZone,
      });
    }
    expect(calls).toEqual([{ monitorIds: ["1"] }, { monitorIds: ["1"] }]);
    for (const call of calls)
      expect(Object.hasOwn(call, "timezone")).toBe(false);
  });

  test("a zoned read passes the zone and keys the local days it returns", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({
      data: [
        hist({ day: "2026-11-03T00:00:00.000Z", errorRegions: 1, runs: 10 }),
      ],
    }));
    const quorum = await fetchLiveQuorum({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      quorumPipes,
      timeZone: "Europe/Berlin",
    });
    expect(calls).toEqual([{ monitorIds: ["1"], timezone: "Europe/Berlin" }]);
    expect(quorum.get("1")?.get("2026-11-03")).toEqual({
      regionCount: 6,
      buckets: [{ errorRegions: 1, notOkRegions: 0, runs: 10 }],
    });
  });

  test("private-only and heartbeat monitors are never fetched", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({ data: [] }));
    const quorum = await fetchLiveQuorum({
      monitors: [
        { id: 1, jobType: "http", regions: "" },
        { id: 2, jobType: "heartbeat", regions: "" },
      ],
      quorumPipes,
    });
    expect(calls).toEqual([]);
    expect(quorum.size).toBe(0);
  });

  test("a failed histogram leaves the monitor out and never throws", async () => {
    const { pipes: quorumPipes } = pipes(async ({ monitorIds }) => {
      if (monitorIds.includes("1")) throw new Error("tinybird 500");
      return { data: [hist({ monitorId: "2" })] };
    });
    const quorum = await fetchLiveQuorum({
      monitors: [
        { id: 1, jobType: "http", regions: sixRegions },
        { id: 2, jobType: "tcp", regions: sixRegions },
      ],
      quorumPipes,
      attempts: 1,
      sleep,
    });
    expect(quorum.has("1")).toBe(false);
    expect(quorum.get("2")?.has("2026-11-02")).toBe(true);
  });
});

describe("attachQuorum", () => {
  const quorumDay = {
    regionCount: 6,
    buckets: [{ errorRegions: 1, notOkRegions: 1, runs: 144 }],
  };

  test("attaches by day key, leaves other days and monitors on per-region counts", () => {
    const rows = new Map([
      [
        "1",
        [
          {
            monitorId: "1",
            day: "2026-11-02T00:00:00.000Z",
            ok: 720,
            error: 144,
          },
          {
            monitorId: "1",
            day: "2026-11-01T00:00:00.000Z",
            ok: 864,
            error: 0,
          },
        ],
      ],
      [
        "2",
        [{ monitorId: "2", day: "2026-11-02T00:00:00.000Z", ok: 5, error: 1 }],
      ],
    ]);
    const out = attachQuorum(
      rows,
      new Map([["1", new Map([["2026-11-02", quorumDay]])]]),
    );
    expect(out.get("1")?.[0]?.quorum).toEqual(quorumDay);
    expect(out.get("1")?.[1]?.quorum).toBeUndefined();
    expect(out.get("2")?.[0]?.quorum).toBeUndefined();
    expect(rows.get("1")?.[0]).not.toHaveProperty("quorum");
  });

  test("1 of 6 regions failing every run: the day is up and counted in runs", () => {
    const [day] =
      attachQuorum(
        new Map([
          [
            "1",
            [
              {
                monitorId: "1",
                day: "2026-11-02T00:00:00.000Z",
                ok: 720,
                degraded: 0,
                error: 144,
              },
            ],
          ],
        ]),
        new Map([["1", new Map([["2026-11-02", quorumDay]])]]),
      ).get("1") ?? [];
    expect(day && tallyDay(day)).toEqual({
      up: 144,
      total: 144,
      ok: 144,
      degraded: 0,
      error: 0,
      status: "success",
    });
  });
});
