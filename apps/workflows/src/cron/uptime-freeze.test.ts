import { db, eq } from "@openstatus/db";
import { frozenMonitorUptime } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import type {
  ComputeCountRow,
  StatusPipeFn,
  UptimeFreezePipes,
  UptimeRunsPipes,
} from "@openstatus/services/frozen-uptime";
import { Hono } from "hono";
import { beforeAll, describe, expect, test } from "vitest";

import { SCHEDULED_TASKS } from "./scheduler";
import {
  handleUptimeBackfillBuckets,
  handleUptimeRefreeze,
  runUptimeFreezeTick,
} from "./uptime-freeze";

let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

function recordingPipe(rows: (monitorIds: string[]) => ComputeCountRow[]) {
  const calls: string[][] = [];
  const pipe: StatusPipeFn = (params) => {
    calls.push(params.monitorIds);
    return Promise.resolve({ data: rows(params.monitorIds) });
  };
  return { pipe, calls };
}

function pipesFor(pipe: StatusPipeFn) {
  const pipes: UptimeFreezePipes = {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
    heartbeat: pipe,
  };
  const runsPipes: UptimeRunsPipes = {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
  };
  return { pipes, runsPipes };
}

const okDay = (ids: string[]) =>
  ids.map((monitorId) => ({
    monitorId,
    day: "2026-10-05",
    ok: 10,
    degraded: 0,
    error: 0,
  }));

describe("runUptimeFreezeTick", () => {
  test("is scheduled daily", () => {
    const task = SCHEDULED_TASKS.find((t) => t.name === "uptime-freeze-daily");
    expect(task?.expression).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  test("two machines at once freeze each monitor and month once", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const { pipe } = recordingPipe(okDay);
    const reports: string[] = [];
    const run = () =>
      runUptimeFreezeTick({
        ...pipesFor(pipe),
        now: new Date("2026-11-03T04:00:00Z"),
        monitorIds: [m.id],
        report: async (message) => {
          reports.push(message);
        },
      });

    const results = await Promise.all([run(), run()]);

    const rows = await db
      .select()
      .from(frozenMonitorUptime)
      .where(eq(frozenMonitorUptime.monitorId, m.id));
    expect(rows.map((r) => r.month)).toEqual(["2026-10-01"]);
    expect(results.map((r) => r?.frozen).sort()).toEqual([0, 1]);
    expect(reports).toEqual([]);
  });

  test("a day on which everything is frozen makes no Tinybird call", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const first = recordingPipe(okDay);
    await runUptimeFreezeTick({
      ...pipesFor(first.pipe),
      now: new Date("2026-11-03T04:00:00Z"),
      monitorIds: [m.id],
      report: async () => {},
    });
    expect(first.calls.length).toBeGreaterThan(0);

    const next = recordingPipe(okDay);
    const res = await runUptimeFreezeTick({
      ...pipesFor(next.pipe),
      now: new Date("2026-11-04T04:00:00Z"),
      monitorIds: [m.id],
      report: async () => {},
    });

    expect(next.calls).toEqual([]);
    expect(res).toMatchObject({ frozen: 0, alreadyFrozen: 1, failures: [] });
  });

  test("past the 45-day cutoff it does nothing and reports nothing", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const { pipe, calls } = recordingPipe(okDay);
    const reports: string[] = [];

    const res = await runUptimeFreezeTick({
      ...pipesFor(pipe),
      now: new Date("2026-11-15T00:00:00Z"),
      monitorIds: [m.id],
      report: async (message) => {
        reports.push(message);
      },
    });

    expect(res).toBeNull();
    expect(calls).toEqual([]);
    expect(reports).toEqual([]);
  });

  test("Tinybird failures are reported like the route reports them", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const dead: StatusPipeFn = () => Promise.reject(new Error("tb down"));
    const reports: string[] = [];

    const res = await runUptimeFreezeTick({
      ...pipesFor(dead),
      now: new Date("2026-11-03T04:00:00Z"),
      monitorIds: [m.id],
      sleep: () => Promise.resolve(),
      report: async (message) => {
        reports.push(message);
      },
    });

    expect(res?.skipped).toBe(1);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toContain("uptime-freeze 2026-10-01: 1 failures");
    expect(reports[0]).toContain(
      `monitor ${m.id}: tinybird counts unavailable`,
    );
  });

  test("reports months frozen without bad ranges, and still freezes them", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    // the default bucket pipes return no rows under test, so errors cannot add up
    const { pipe } = recordingPipe((ids) =>
      okDay(ids).map((row) => ({ ...row, error: 3 })),
    );
    const reports: string[] = [];

    const res = await runUptimeFreezeTick({
      ...pipesFor(pipe),
      now: new Date("2026-11-03T04:00:00Z"),
      monitorIds: [m.id],
      report: async (message) => {
        reports.push(message);
      },
    });

    expect(res).toMatchObject({ frozen: 1, bucketMismatch: 1, failures: [] });
    expect(reports).toEqual([
      "uptime-freeze 2026-10-01: 1 monitors frozen without bad ranges (bucket sums did not match the day counts)",
    ]);
  });

  test("warns once when monitors are still unfrozen close to the cutoff", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const dead: StatusPipeFn = () => Promise.reject(new Error("tb down"));
    const reports: string[] = [];

    await runUptimeFreezeTick({
      ...pipesFor(dead),
      now: new Date("2026-11-13T04:29:00Z"),
      monitorIds: [m.id],
      sleep: () => Promise.resolve(),
      report: async (message) => {
        reports.push(message);
      },
    });

    const warnings = reports.filter((r) => r.includes("cutoff"));
    expect(warnings).toEqual([
      "uptime-freeze 2026-10-01: 1 monitors with data still unfrozen, 43h before the 45d Tinybird cutoff",
    ]);
  });

  test("does not warn close to the cutoff when everything is frozen", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const reports: string[] = [];

    const res = await runUptimeFreezeTick({
      ...pipesFor(recordingPipe(okDay).pipe),
      now: new Date("2026-11-13T04:29:00Z"),
      monitorIds: [m.id],
      report: async (message) => {
        reports.push(message);
      },
    });

    expect(res?.frozen).toBe(1);
    expect(reports).toEqual([]);
  });
});

describe("handleUptimeRefreeze", () => {
  test("refuses a month that has not ended, forced or not", async () => {
    const app = new Hono().get("/refreeze", handleUptimeRefreeze);
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const res = await app.request(
      `/refreeze?month=${month}&monitorIds=1&force=true`,
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({ success: false, held: true, frozen: 0 });
    expect(body.error).toContain("has not ended");
  });
});

describe("handleUptimeBackfillBuckets", () => {
  const app = new Hono().get("/backfill", handleUptimeBackfillBuckets);

  test("rejects a month that is not the first of a month", async () => {
    const res = await app.request("/backfill?month=2026-08-15");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("YYYY-MM-01");
  });

  test("gives a clean row frozen without ranges its bucket size", async () => {
    const m = await createMonitor(workspaceId, {
      jobType: "http",
      regions: "ams",
      active: true,
    });
    const days = [
      { day: "2026-08-05", requests: { ok: 96, degraded: 0, error: 0 } },
    ];
    await db.insert(frozenMonitorUptime).values({
      monitorId: m.id,
      workspaceId,
      month: "2026-08-01",
      days,
    });

    // the Tinybird client returns no rows under test: nothing failed, so it adds up
    const res = await app.request(
      `/backfill?month=2026-08-01&monitorIds=${m.id}`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      month: "2026-08-01",
      updated: 1,
      mismatched: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    });
    const [row] = await db
      .select()
      .from(frozenMonitorUptime)
      .where(eq(frozenMonitorUptime.monitorId, m.id));
    expect(row.bucketMinutes).toBe(15);
    expect(row.days).toEqual(days);
  });
});
