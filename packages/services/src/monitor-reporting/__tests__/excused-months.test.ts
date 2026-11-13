import { eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { exportMonitorReporting } from "../export";
import { getMonitorReporting } from "../get";
import { listMonitorReportings } from "../list";
import { sealMonitorSlaMonths } from "../seal";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const MIN = 60_000;
const at = (month: number, d: number, h = 0, m = 0) =>
  Date.UTC(2026, month, d, h, m);
const now = new Date(at(10, 15, 12));
// October is still judged on episodes: before its seal, within the runs kept
const previewNow = new Date(at(10, 3, 12));
const sealNow = new Date(at(10, 5));

// one run every 10 minutes from Oct 1; runs inside an outage failed
const OUTAGES = [
  { start: at(9, 20, 22), end: at(9, 20, 23) },
  { start: at(10, 1, 0), end: at(10, 1, 1) },
];
const STEP = 10 * MIN;

const episodesPipes = episodesPipesFrom(() =>
  runsEvery(at(9, 1), at(11, 31), STEP, (t) =>
    OUTAGES.some((o) => o.start <= t && t < o.end) ? "error" : "ok",
  ),
);
const sleep = async () => {};

let ctx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function setup(tx: Tx) {
  const api = await tx
    .insert(monitor)
    .values({
      workspaceId: ctx.workspace.id,
      active: true,
      url: "https://example.com",
      name: "svc-sla-excused",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_900,
      createdAt: new Date(at(9, 1)),
    })
    .returning()
    .get();
  await tx.insert(monitorSlaPolicyToMonitor).values({
    monitorSlaPolicyId: policy.id,
    monitorId: api.id,
    createdAt: new Date(at(9, 1)),
  });
  return { api, policy };
}

async function excuse(tx: Tx, policyId: number, from: number, to: number) {
  return tx
    .insert(monitorSlaExcusedWindow)
    .values({
      workspaceId: ctx.workspace.id,
      monitorSlaPolicyId: policyId,
      kind: "maintenance",
      reason: "Database upgrade",
      from: new Date(from),
      to: new Date(to),
    })
    .returning()
    .get();
}

function get(tx: Tx, id: number, at = previewNow) {
  return getMonitorReporting({
    ctx: { ...ctx, db: tx },
    input: { id },
    now: at,
    episodesPipes,
    sleep,
  });
}

function cell(detail: Awaited<ReturnType<typeof get>>, month: string) {
  return detail.monitors[0]?.months.find((m) => m.month === month);
}

describe("excused windows in a month's figure", () => {
  test("excused runs drop from both sides of the fraction", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      expect(cell(await get(tx, policy.id), "2026-10-01")).toMatchObject({
        state: "preview",
        met: false,
        // 4458 of 4464
        uptime: 99_865,
      });

      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));

      expect(cell(await get(tx, policy.id), "2026-10-01")).toMatchObject({
        state: "preview",
        counts: { ok: 4458, degraded: 0, error: 6 },
        excused: { ok: 0, degraded: 0, error: 6 },
        met: true,
        uptime: 100_000,
      });
    });
  });

  test("overlapping windows excuse a run once", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 21), at(9, 20, 22, 40));
      await excuse(tx, policy.id, at(9, 20, 22, 20), at(9, 20, 23));

      // 21:00 to 23:00: six ok runs, six failed
      expect(cell(await get(tx, policy.id), "2026-10-01")).toMatchObject({
        excused: { ok: 6, degraded: 0, error: 6 },
        uptime: 100_000,
      });
    });
  });

  test("a window across two months is split at the boundary", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 31, 23), at(10, 1, 1));

      const detail = await get(tx, policy.id);
      expect(cell(detail, "2026-10-01")?.excused).toEqual({
        ok: 6,
        degraded: 0,
        error: 0,
      });
      expect(cell(detail, "2026-11-01")).toMatchObject({
        state: "live",
        method: "time",
        counts: { ok: 354, degraded: 0, error: 6 },
        excused: { ok: 0, degraded: 0, error: 6 },
        excusedMs: 60 * MIN,
        downMs: 0,
        uptime: 100_000,
      });
    });
  });

  test("the list asks no Tinybird for a month past its runs: never sealed, it has no judgement", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      const noTinybird = new Proxy(
        {},
        {
          get(_, prop) {
            throw new Error(`Tinybird touched: ${String(prop)}`);
          },
        },
      ) as NonNullable<ServiceContext["tb"]>;
      const list = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });
      const item = list.find((p) => p.id === policy.id);
      expect(item?.months.at(-1)).toEqual({
        month: "2026-10-01",
        status: "none",
        preview: false,
      });
      expect(item?.missed).toEqual({ months: 0, previews: 0, of: 12 });
    });
  });

  test("a sealed month on the list keeps its excused judgement", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      const list = await listMonitorReportings({
        ctx: { ...ctx, db: tx },
        now,
      });
      expect(list.find((p) => p.id === policy.id)?.months.at(-1)).toEqual({
        month: "2026-10-01",
        status: "met",
        preview: false,
      });
    });
  });

  test("the export counts excused runs", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      const { csv } = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now: previewNow,
        episodesPipes,
        sleep,
      });
      const [header, row] = csv.trim().split("\r\n").slice(2);
      const columns = header.split(",");
      const values = row.split(",");
      const value = (name: string) => values[columns.indexOf(name)];
      expect(value("excused_runs")).toBe("6");
      expect(value("uptime")).toBe("100.000");
      expect(value("met")).toBe("yes");
    });
  });
});

describe("sealing with excused windows", () => {
  test("a sealed month records its excused runs and the windows that applied", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      const w = await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      // a November window is not October's
      await excuse(tx, policy.id, at(10, 2), at(10, 2, 1));

      const res = await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(res).toMatchObject({ sealed: 1, unavailable: 0 });

      const [row] = await tx
        .select()
        .from(monitorSlaSealedMonth)
        .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id))
        .all();
      expect(row).toMatchObject({
        ok: 4458,
        error: 6,
        excusedOk: 0,
        excusedDegraded: 0,
        excusedError: 6,
        total: 4458,
        up: 4458,
        uptime: 100_000,
        met: true,
        excusedWindows: [
          {
            id: w.id,
            kind: "maintenance",
            reason: "Database upgrade",
            from: at(9, 20, 22),
            to: at(9, 20, 23),
          },
        ],
      });

      const detail = await get(tx, policy.id);
      expect(cell(detail, "2026-10-01")).toMatchObject({
        state: "sealed",
        excused: { ok: 0, degraded: 0, error: 6 },
      });
      const locks = detail.excusedWindows.map((x) => [x.id, x.locked]);
      expect(locks).toContainEqual([w.id, "sealed"]);
    });
  });

  test("a month wholly excused is sealed without a judgement, keeping its windows", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 1), at(10, 1));

      const res = await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(res.sealed).toBe(1);
      const [row] = await tx
        .select()
        .from(monitorSlaSealedMonth)
        .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id))
        .all();
      expect(row).toMatchObject({
        excusedOk: 4458,
        excusedError: 6,
        total: 0,
        uptime: null,
        met: null,
        measuredMs: 0,
        excusedMs: at(10, 1) - at(9, 1),
        coverage: null,
      });
      expect(row?.excusedWindows).toHaveLength(1);
      expect(cell(await get(tx, policy.id), "2026-10-01")).toMatchObject({
        state: "sealed",
        met: null,
        uptime: null,
      });
    });
  });

  test("when the episodes cannot be read the pair waits for the next run", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      const failing = failingEpisodesPipes();
      const res = await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes: failing,
        sleep,
      });
      expect(res).toMatchObject({ sealed: 0, unavailable: 1 });
    });
  });
});

describe("months past the runs kept", () => {
  const december = new Date(at(11, 10, 12));

  test("a month never sealed has no judgement, on the page and in the export", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      const detail = await get(tx, policy.id, december);
      expect(cell(detail, "2026-10-01")).toMatchObject({
        state: "none",
        method: null,
        counts: null,
        met: null,
        uptime: null,
      });

      const { csv } = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now: december,
        episodesPipes,
        sleep,
      });
      const [, comment, header, row] = csv.trim().split("\r\n");
      expect(comment).toContain(
        "Months that were never sealed and are no longer the running or previous month, or whose checks are no longer kept, have no judgement.",
      );
      const columns = header.split(",");
      const values = row.split(",");
      const value = (name: string) => values[columns.indexOf(name)];
      expect(value("state")).toBe("none");
      expect(value("uptime")).toBe("");
      expect(value("met")).toBe("");
    });
  });
});

describe("export without live months", () => {
  test("leaves the live month out", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      // November on Dec 5 is a preview judged on episodes; December is left out
      await excuse(tx, policy.id, at(10, 2), at(10, 2, 1));
      const { csv } = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-11" },
        now: new Date(at(11, 5)),
        episodesPipes,
        sleep,
      });
      expect(csv).toContain("2026-11,preview");
      expect(csv).not.toContain("live");
    });
  });
});

describe("sealing while a window changes", () => {
  test("a window added while the month is counted defers the policy to the next run", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      let added = false;
      const racing = { ...episodesPipes };
      const http = racing.http;
      racing.http = async (p) => {
        if (!added) {
          added = true;
          await excuse(tx, policy.id, at(9, 5), at(9, 5, 1));
        }
        return http(p);
      };

      const first = await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes: racing,
        sleep,
      });
      expect(first).toMatchObject({
        sealed: 0,
        unavailable: 1,
        unavailablePolicyIds: [policy.id],
      });

      const second = await sealMonitorSlaMonths({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(second.sealed).toBe(1);
      const [row] = await tx
        .select()
        .from(monitorSlaSealedMonth)
        .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id))
        .all();
      expect(row?.excusedWindows).toHaveLength(2);
    });
  });
});
