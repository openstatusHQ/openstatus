import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorHeartbeatState,
  monitorIncidentTable,
} from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { getMonitorReport } from "../get-report";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let ctx: ServiceContext;
let otherCtx: ServiceContext;
let monitorId: number;
// created mid-January 2026
const createdAt = new Date(Date.UTC(2026, 0, 15));

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
  ctx = makeUserCtx(team, { userId: 1 });
  otherCtx = makeUserCtx(free, { userId: 2 });
  const row = await db
    .insert(monitor)
    .values({
      workspaceId: team.id,
      active: true,
      url: "https://example.com",
      name: "svc-report-test-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      createdAt,
    })
    .returning()
    .get();
  monitorId = row.id;
});

afterAll(async () => {
  await db
    .delete(monitor)
    .where(eq(monitor.id, monitorId))
    .catch(() => undefined);
});

async function outage(
  tx: DrizzleTx,
  startedAt: Date,
  resolvedAt: Date | null,
  excused?: string,
) {
  return tx
    .insert(monitorIncidentTable)
    .values({
      workspaceId: ctx.workspace.id,
      monitorId,
      startedAt,
      resolvedAt,
      excusedAt: excused ? resolvedAt : null,
      excusedReason: excused ?? null,
    })
    .returning()
    .get();
}

const withoutHistory = (base: ServiceContext): ServiceContext => ({
  ...base,
  workspace: {
    ...base.workspace,
    limits: { ...base.workspace.limits, "uptime-history": false },
  },
});

const feb = {
  from: new Date(Date.UTC(2026, 1, 1)),
  to: new Date(Date.UTC(2026, 2, 1)),
};
const afterPeriod = new Date(Date.UTC(2026, 5, 1));

describe("getMonitorReport", () => {
  test("clips the window to the monitor's creation date", async () => {
    await withTestTransaction(async (tx) => {
      const start = new Date(Date.UTC(2026, 0, 20));
      await outage(tx, start, new Date(start.getTime() + HOUR));
      // before creation: outside the window entirely
      await outage(
        tx,
        new Date(Date.UTC(2026, 0, 10)),
        new Date(Date.UTC(2026, 0, 10, 1)),
      );

      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: {
          monitorId,
          from: new Date(Date.UTC(2026, 0, 1)),
          to: new Date(Date.UTC(2026, 1, 1)),
        },
        now: afterPeriod,
      });

      expect(report.window).toEqual({
        from: createdAt,
        to: new Date(Date.UTC(2026, 1, 1)),
      });
      expect(report.downtimeMs).toBe(HOUR);
      expect(report.outageCount).toBe(1);
      // 17 days in the window, one hour down
      expect(report.availability).toBe(99.754);
      expect(report.incidents.map((i) => i.startedAt)).toEqual([start]);
    });
  });

  test("merges overlapping outages and reports longest and mean time to resolve", async () => {
    await withTestTransaction(async (tx) => {
      const t = Date.UTC(2026, 1, 10);
      await outage(tx, new Date(t), new Date(t + 2 * HOUR));
      await outage(tx, new Date(t + HOUR), new Date(t + 3 * HOUR));

      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: { monitorId, ...feb },
        now: afterPeriod,
      });

      expect(report.downtimeMs).toBe(3 * HOUR);
      expect(report.outageCount).toBe(2);
      expect(report.longestMs).toBe(2 * HOUR);
      expect(report.mttrMs).toBe(2 * HOUR);
    });
  });

  test("excused outages count as up and are reported as excusedMs", async () => {
    await withTestTransaction(async (tx) => {
      const t = Date.UTC(2026, 1, 10);
      await outage(tx, new Date(t), new Date(t + HOUR));
      await outage(
        tx,
        new Date(t + 5 * HOUR),
        new Date(t + 7 * HOUR),
        "planned",
      );

      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: { monitorId, ...feb },
        now: afterPeriod,
      });

      expect(report.downtimeMs).toBe(HOUR);
      expect(report.excusedMs).toBe(2 * HOUR);
      expect(report.outageCount).toBe(1);
      expect(report.longestMs).toBe(HOUR);
      // the list keeps excused outages
      expect(report.incidents).toHaveLength(2);
    });
  });

  test("splits an outage across a UTC month edge", async () => {
    await withTestTransaction(async (tx) => {
      await outage(
        tx,
        new Date(Date.UTC(2026, 0, 31, 23, 30)),
        new Date(Date.UTC(2026, 1, 1, 0, 30)),
      );

      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: { monitorId, ...feb },
        now: afterPeriod,
      });
      expect(
        report.months.map((m) => [m.month, m.downtimeMs, m.outages]),
      ).toEqual([["2026-02-01", 30 * MINUTE, 1]]);

      const wide = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: {
          monitorId,
          from: new Date(Date.UTC(2026, 0, 1)),
          to: new Date(Date.UTC(2026, 2, 1)),
        },
        now: afterPeriod,
      });
      expect(
        wide.months.map((m) => [m.month, m.downtimeMs, m.outages]),
      ).toEqual([
        ["2026-01-01", 30 * MINUTE, 1],
        ["2026-02-01", 30 * MINUTE, 1],
      ]);
      expect(wide.downtimeMs).toBe(HOUR);
    });
  });

  test("counts an open outage up to now", async () => {
    await withTestTransaction(async (tx) => {
      const now = new Date(Date.UTC(2026, 1, 10, 12));
      await outage(tx, new Date(now.getTime() - 2 * HOUR), null);

      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: { monitorId, ...feb },
        now,
      });

      expect(report.window.to).toEqual(now);
      expect(report.downtimeMs).toBe(2 * HOUR);
      expect(report.longestMs).toBe(2 * HOUR);
      // unresolved: no time to resolve yet
      expect(report.mttrMs).toBeNull();
    });
  });

  test("an empty window has no availability", async () => {
    await withTestTransaction(async (tx) => {
      const report = await getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: {
          monitorId,
          from: new Date(Date.UTC(2025, 0, 1)),
          to: new Date(Date.UTC(2025, 1, 1)),
        },
        now: afterPeriod,
      });
      expect(report.availability).toBeNull();
      expect(report.months).toEqual([]);
      expect(report.mttrMs).toBeNull();
      expect(report.longestMs).toBeNull();
    });
  });

  test("rejects a reversed period", async () => {
    await expect(
      getMonitorReport({
        ctx,
        input: { monitorId, from: feb.to, to: feb.from },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("throws NotFoundError for another workspace's monitor", async () => {
    await expect(
      getMonitorReport({
        ctx: otherCtx,
        input: { monitorId, ...feb },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("rejects an actor without monitors:read", async () => {
    const apiCtx = makeApiKeyCtx(ctx.workspace, {
      keyId: "k",
      scopes: ["pages:read"],
    });
    await expect(
      getMonitorReport({
        ctx: apiCtx,
        input: { monitorId, ...feb },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("leaves the months out when the plan has no uptime history", async () => {
    await withTestTransaction(async (tx) => {
      await outage(
        tx,
        new Date(Date.UTC(2026, 1, 10, 0, 0)),
        new Date(Date.UTC(2026, 1, 10, 1, 0)),
      );

      const report = await getMonitorReport({
        ctx: { ...withoutHistory(ctx), db: tx },
        input: { monitorId, ...feb },
        now: new Date(Date.UTC(2026, 2, 5)),
      });

      expect(report.months).toEqual([]);
      expect(report.downtimeMs).toBe(HOUR);
    });
  });

  test("a heartbeat reports no data until its first ping", async () => {
    await withTestTransaction(async (tx) => {
      const heartbeat = await tx
        .insert(monitor)
        .values({
          workspaceId: ctx.workspace.id,
          active: true,
          url: "",
          name: "svc-report-test-heartbeat",
          jobType: "heartbeat",
          periodicity: "10m",
          regions: "",
          createdAt,
        })
        .returning()
        .get();
      const report = () =>
        getMonitorReport({
          ctx: { ...ctx, db: tx },
          input: { monitorId: heartbeat.id, ...feb },
          now: new Date(Date.UTC(2026, 2, 5)),
        });

      const waiting = await report();
      expect(waiting.availability).toBeNull();
      expect(waiting.months).toEqual([]);

      await tx.insert(monitorHeartbeatState).values({
        monitorId: heartbeat.id,
        lastPingAt: new Date(Date.UTC(2026, 1, 2)),
      });
      expect((await report()).availability).toBe(100);
    });
  });

  describe("heartbeat coverage", () => {
    const reportFor = async (
      tx: DrizzleTx,
      state: { firstPingAt: Date | null; lastPingAt: Date },
      outages: Array<[Date, Date]> = [],
    ) => {
      const heartbeat = await tx
        .insert(monitor)
        .values({
          workspaceId: ctx.workspace.id,
          active: true,
          url: "",
          name: "svc-report-test-heartbeat-coverage",
          jobType: "heartbeat",
          periodicity: "10m",
          regions: "",
          createdAt,
        })
        .returning()
        .get();
      await tx
        .insert(monitorHeartbeatState)
        .values({ monitorId: heartbeat.id, ...state });
      for (const [startedAt, resolvedAt] of outages) {
        await tx.insert(monitorIncidentTable).values({
          workspaceId: ctx.workspace.id,
          monitorId: heartbeat.id,
          startedAt,
          resolvedAt,
        });
      }
      return getMonitorReport({
        ctx: { ...ctx, db: tx },
        input: { monitorId: heartbeat.id, ...feb },
        now: new Date(Date.UTC(2026, 2, 5)),
      });
    };
    const lastPingAt = new Date(Date.UTC(2026, 1, 20));

    test("starts on the day of the first ping, not at creation", async () => {
      await withTestTransaction(async (tx) => {
        const report = await reportFor(
          tx,
          { firstPingAt: new Date(Date.UTC(2026, 1, 10, 13, 30)), lastPingAt },
          [[new Date(Date.UTC(2026, 1, 15)), new Date(Date.UTC(2026, 1, 16))]],
        );

        expect(report.window).toEqual({
          from: new Date(Date.UTC(2026, 1, 10)),
          to: new Date(Date.UTC(2026, 2, 1)),
        });
        // one day down out of the 19 measured, not out of 28
        expect(report.availability).toBe(94.736);
      });
    });

    test("an outage before the first ping pulls the start back", async () => {
      await withTestTransaction(async (tx) => {
        const report = await reportFor(
          tx,
          { firstPingAt: new Date(Date.UTC(2026, 1, 10)), lastPingAt },
          [[new Date(Date.UTC(2026, 1, 5)), new Date(Date.UTC(2026, 1, 6))]],
        );

        expect(report.window.from).toEqual(new Date(Date.UTC(2026, 1, 5)));
      });
    });

    test("a row without a first ping keeps the creation date", async () => {
      await withTestTransaction(async (tx) => {
        const report = await reportFor(tx, { firstPingAt: null, lastPingAt });

        expect(report.window.from).toEqual(new Date(Date.UTC(2026, 1, 1)));
        expect(report.availability).toBe(100);
      });
    });
  });
});
