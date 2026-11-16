import { eq } from "@openstatus/db";
import {
  monitor,
  uptimeTargetExcusedWindow,
  uptimeTargetExcusedWindowToMonitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { exportUptimeTarget } from "../export";
import { getUptimeTarget } from "../get";
import { listUptimeTargets } from "../list";
import { sealUptimeTargetMonths } from "../seal";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";
import { sealFromChecks, storeUptime } from "./fixtures/uptime-store";

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
      name: "svc-uptime-target-excused",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  const policy = await tx
    .insert(uptimeTarget)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_900,
      createdAt: new Date(at(9, 1)),
    })
    .returning()
    .get();
  await tx.insert(uptimeTargetToMonitor).values({
    uptimeTargetId: policy.id,
    monitorId: api.id,
    createdAt: new Date(at(9, 1)),
  });
  return { api, policy };
}

async function excuse(tx: Tx, policyId: number, from: number, to: number) {
  return tx
    .insert(uptimeTargetExcusedWindow)
    .values({
      workspaceId: ctx.workspace.id,
      uptimeTargetId: policyId,
      kind: "maintenance",
      reason: "Database upgrade",
      from: new Date(from),
      to: new Date(to),
    })
    .returning()
    .get()
    .then(async (row) => {
      const members = await tx
        .select({ id: uptimeTargetToMonitor.monitorId })
        .from(uptimeTargetToMonitor)
        .where(eq(uptimeTargetToMonitor.uptimeTargetId, policyId))
        .all();
      await tx.insert(uptimeTargetExcusedWindowToMonitor).values(
        members.map((m) => ({
          uptimeTargetExcusedWindowId: row.id,
          monitorId: m.id,
        })),
      );
      return row;
    });
}

function get(tx: Tx, id: number, at = previewNow) {
  return getUptimeTarget({
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
  test("excused time drops from both sides of the fraction", async () => {
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
        measuredMs: at(10, 1) - at(9, 1) - 60 * MIN,
        downMs: 0,
        excusedMs: 60 * MIN,
        met: true,
        uptime: 100_000,
      });
    });
  });

  test("overlapping windows excuse time once", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 21), at(9, 20, 22, 40));
      await excuse(tx, policy.id, at(9, 20, 22, 20), at(9, 20, 23));

      // 21:00 to 23:00: an hour up, an hour down
      expect(cell(await get(tx, policy.id), "2026-10-01")).toMatchObject({
        excusedMs: 120 * MIN,
        downMs: 0,
        uptime: 100_000,
      });
    });
  });

  test("a window across two months is split at the boundary", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 31, 23), at(10, 1, 1));

      const detail = await get(tx, policy.id);
      expect(cell(detail, "2026-10-01")?.excusedMs).toBe(60 * MIN);
      expect(cell(detail, "2026-11-01")).toMatchObject({
        state: "live",
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
      const list = await listUptimeTargets({
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
      await sealFromChecks({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      const list = await listUptimeTargets({
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

  test("the export states the excused time", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      const { csv } = await exportUptimeTarget({
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
      expect(value("excused_ms")).toBe(String(60 * MIN));
      expect(value("uptime")).toBe("100.000");
      expect(value("met")).toBe("yes");
    });
  });
});

describe("sealing with excused windows", () => {
  test("a sealed month records its excused time and the windows that applied", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      const w = await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      // a November window is not October's
      await excuse(tx, policy.id, at(10, 2), at(10, 2, 1));

      const res = await sealFromChecks({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(res).toMatchObject({ sealed: 1, unavailable: 0 });

      const [row] = await tx
        .select()
        .from(uptimeTargetSealedMonth)
        .where(eq(uptimeTargetSealedMonth.uptimeTargetId, policy.id))
        .all();
      expect(row).toMatchObject({
        measuredMs: at(10, 1) - at(9, 1) - 60 * MIN,
        downMs: 0,
        excusedMs: 60 * MIN,
        unmeasuredMs: 0,
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
        excusedMs: 60 * MIN,
      });
      const locks = detail.excusedWindows.map((x) => [x.id, x.locked]);
      expect(locks).toContainEqual([w.id, "sealed"]);
    });
  });

  test("a month wholly excused is sealed without a judgement, keeping its windows", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx);
      await excuse(tx, policy.id, at(9, 1), at(10, 1));

      const res = await sealFromChecks({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(res.sealed).toBe(1);
      const [row] = await tx
        .select()
        .from(uptimeTargetSealedMonth)
        .where(eq(uptimeTargetSealedMonth.uptimeTargetId, policy.id))
        .all();
      expect(row).toMatchObject({
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
      const res = await sealFromChecks({
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
        measuredMs: null,
        met: null,
        uptime: null,
      });

      const { csv } = await exportUptimeTarget({
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
      const { csv } = await exportUptimeTarget({
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
      const { policy, api } = await setup(tx);
      await excuse(tx, policy.id, at(9, 20, 22), at(9, 20, 23));
      await storeUptime({
        db: tx,
        now: sealNow,
        monitorIds: [api.id],
        episodesPipes,
        sleep,
      });
      // the seal read its windows before its first write transaction opens
      let added = false;
      const racing = new Proxy(tx, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          if (prop !== "transaction") {
            return typeof value === "function" ? value.bind(target) : value;
          }
          return async (run: Parameters<Tx["transaction"]>[0]) => {
            if (!added) {
              added = true;
              await excuse(tx, policy.id, at(9, 5), at(9, 5, 1));
            }
            return target.transaction(run);
          };
        },
      });

      const first = await sealUptimeTargetMonths({
        db: racing,
        now: sealNow,
        policyIds: [policy.id],
      });
      expect(first).toMatchObject({
        sealed: 0,
        unavailable: 1,
        unavailablePolicyIds: [policy.id],
      });

      const second = await sealFromChecks({
        db: tx,
        now: sealNow,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      expect(second.sealed).toBe(1);
      const [row] = await tx
        .select()
        .from(uptimeTargetSealedMonth)
        .where(eq(uptimeTargetSealedMonth.uptimeTargetId, policy.id))
        .all();
      expect(row?.excusedWindows).toHaveLength(2);
    });
  });
});
