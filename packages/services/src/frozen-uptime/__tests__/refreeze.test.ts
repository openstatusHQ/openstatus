import { eq } from "@openstatus/db";
import { frozenMonitorUptime, monitor } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { ComputeCountRow } from "../compute";
import {
  type StatusPipeFn,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
  refreezeMonitorMonths,
} from "../run";

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

const noSleep = () => Promise.resolve();
const now = new Date(Date.UTC(2026, 6, 10));

function pipesServing(pipe: StatusPipeFn): {
  pipes: UptimeFreezePipes;
  runsPipes: UptimeRunsPipes;
} {
  return {
    pipes: {
      http: pipe,
      tcp: pipe,
      dns: pipe,
      icmp: pipe,
      grpc: pipe,
      heartbeat: pipe,
    },
    runsPipes: {
      http: () => Promise.resolve({ data: [] }),
      tcp: pipe,
      dns: pipe,
      icmp: pipe,
      grpc: pipe,
    },
  };
}

function countsPipe(rows: ComputeCountRow[]) {
  const calls: string[][] = [];
  const pipe: StatusPipeFn = (params) => {
    calls.push(params.monitorIds);
    return Promise.resolve({ data: rows });
  };
  return { pipe, calls };
}

async function insertFrozenMonitor(tx: Tx, ok: number) {
  const m = await tx
    .insert(monitor)
    .values({
      workspaceId,
      active: true,
      url: "https://example.com",
      name: "svc-refreeze-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  await tx.insert(frozenMonitorUptime).values({
    monitorId: m.id,
    workspaceId,
    month: "2026-06-01",
    days: [{ day: "2026-06-05", requests: { ok, degraded: 0, error: 0 } }],
  });
  return m;
}

async function frozenRows(tx: Tx, monitorId: number) {
  return tx
    .select()
    .from(frozenMonitorUptime)
    .where(eq(frozenMonitorUptime.monitorId, monitorId))
    .all();
}

describe("refreezeMonitorMonths", () => {
  test("replaces an existing row with the recomputed month", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 1);
      const { pipe } = countsPipe([
        {
          monitorId: String(m.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 3,
        },
      ]);

      const res = await refreezeMonitorMonths({
        ...pipesServing(pipe),
        month: "2026-06-01",
        monitorIds: [m.id],
        now,
        db: tx,
        sleep: noSleep,
      });

      expect(res).toMatchObject({ month: "2026-06-01", frozen: 1 });
      expect(res.failures).toEqual([]);
      const rows = await frozenRows(tx, m.id);
      expect(rows.length).toBe(1);
      expect(rows[0].days.length).toBe(30);
      expect(rows[0].days[4].requests).toEqual({
        ok: 42,
        degraded: 0,
        error: 3,
      });
    });
  });

  test("reads the whole month the cutoff allows, not the 45d default", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 1);
      const calls: Parameters<StatusPipeFn>[0][] = [];
      const pipe: StatusPipeFn = (params) => {
        calls.push(params);
        return Promise.resolve({ data: [] });
      };

      await refreezeMonitorMonths({
        pipes: pipesServing(pipe).pipes,
        runsPipes: pipesServing(pipe).pipes,
        month: "2026-06-01",
        monitorIds: [m.id],
        now,
        db: tx,
        sleep: noSleep,
      });

      // counts, then runs (the monitor has cloud regions)
      expect(calls).toEqual([
        { monitorIds: [String(m.id)], days: 46 },
        { monitorIds: [String(m.id)], days: 46 },
      ]);
    });
  });

  test("leaves the existing row alone when a pipe chunk fails", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 7);
      const dead: StatusPipeFn = () => Promise.reject(new Error("tb down"));

      const res = await refreezeMonitorMonths({
        ...pipesServing(dead),
        month: "2026-06-01",
        monitorIds: [m.id],
        now,
        db: tx,
        sleep: noSleep,
      });

      expect(res.frozen).toBe(0);
      expect(res.skipped).toBe(1);
      expect(res.failures).toEqual([
        `monitor ${m.id}: tinybird counts unavailable`,
      ]);
      const rows = await frozenRows(tx, m.id);
      expect(rows[0].days).toEqual([
        { day: "2026-06-05", requests: { ok: 7, degraded: 0, error: 0 } },
      ]);
    });
  });

  test("refuses a month past the cutoff without reading Tinybird", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 7);
      const { pipe, calls } = countsPipe([]);

      const res = await refreezeMonitorMonths({
        ...pipesServing(pipe),
        month: "2026-06-01",
        monitorIds: [m.id],
        now: new Date(Date.UTC(2026, 6, 16)),
        db: tx,
        sleep: noSleep,
      });

      expect(calls).toEqual([]);
      expect(res.frozen).toBe(0);
      expect(res.failures).toHaveLength(1);
      expect(res.failures[0]).toContain("45d");
      expect((await frozenRows(tx, m.id))[0].days[0].requests.ok).toBe(7);
    });
  });

  test("goes through the 48-hour hold unless forced", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 7);
      const { pipe, calls } = countsPipe([
        {
          monitorId: String(m.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 0,
        },
      ]);
      const args = {
        ...pipesServing(pipe),
        month: "2026-06-01",
        monitorIds: [m.id],
        now: new Date("2026-07-01T12:00:00Z"),
        db: tx,
        sleep: noSleep,
      };

      const held = await refreezeMonitorMonths(args);
      expect(held).toMatchObject({ held: true, frozen: 0, failures: [] });
      expect(calls).toEqual([]);

      const forced = await refreezeMonitorMonths({ ...args, force: true });
      expect(forced.frozen).toBe(1);
    });
  });

  test("never freezes a month that has not ended, forced or not", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 7);
      const { pipe, calls } = countsPipe([
        {
          monitorId: String(m.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 0,
        },
      ]);

      const res = await refreezeMonitorMonths({
        ...pipesServing(pipe),
        month: "2026-06-01",
        monitorIds: [m.id],
        now: new Date("2026-06-19T12:00:00Z"),
        force: true,
        db: tx,
        sleep: noSleep,
      });

      expect(res.frozen).toBe(0);
      expect(res.failures[0]).toContain("has not ended");
      expect(calls).toEqual([]);
      expect((await frozenRows(tx, m.id))[0].days[0].requests.ok).toBe(7);
    });
  });

  test("reports a monitor whose row it could not replace", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx, 7);
      const { pipe } = countsPipe([]);

      const res = await refreezeMonitorMonths({
        ...pipesServing(pipe),
        month: "2026-06-01",
        monitorIds: [m.id],
        now,
        db: tx,
        sleep: noSleep,
      });

      expect(res.frozen).toBe(0);
      expect(res.failures).toEqual([
        `monitor ${m.id}: no counts in Tinybird, row unchanged`,
      ]);
    });
  });

  test("rejects a month that is not the first of a month", async () => {
    const { pipe } = countsPipe([]);
    await expect(
      refreezeMonitorMonths({
        ...pipesServing(pipe),
        month: "2026-06-15",
        monitorIds: [1],
        now,
      }),
    ).rejects.toThrow();
  });
});
