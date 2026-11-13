import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { monthDays } from "../../frozen-uptime/compute";
import { exportMonitorReporting, MONITOR_SLA_METHOD } from "../export";
import { getMonitorReporting } from "../get";
import {
  type EpisodesCall,
  episodesPipesFrom,
  failingEpisodesPipes,
  noEpisodes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const now = new Date(Date.UTC(2026, 10, 15, 12));
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const sleep = async () => {};

let ctx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitor(
  tx: Tx,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: ctx.workspace.id,
      active: true,
      url: "https://example.com",
      name: "svc-sla-export",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

async function insertPolicy(
  tx: Tx,
  monitorIds: number[],
  overrides: Partial<typeof monitorSlaPolicy.$inferInsert> = {},
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_500,
      ...overrides,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(monitorSlaPolicyToMonitor).values(
      monitorIds.map((monitorId) => ({
        monitorSlaPolicyId: policy.id,
        monitorId,
        createdAt: new Date(Date.UTC(2025, 0, 1)),
      })),
    );
  }
  return policy;
}

function frozen(
  monitorId: number,
  month: string,
  runs: { ok: number; degraded?: number; error: number },
) {
  return {
    workspaceId: ctx.workspace.id,
    monitorId,
    month: `${month}-01`,
    days: monthDays(`${month}-01`).map((day, i) => ({
      day,
      requests: { ok: 10, degraded: 0, error: 0 },
      ...(i === 0
        ? {
            runs: {
              ok: runs.ok,
              degraded: runs.degraded ?? 0,
              error: runs.error,
            },
          }
        : {}),
    })),
  };
}

function parse(csv: string) {
  const lines = csv.trimEnd().split("\r\n");
  const comments = lines.filter((l) => l.startsWith("#"));
  const [header, ...rows] = lines.filter((l) => !l.startsWith("#"));
  return { comments, header, rows };
}

describe("exportMonitorReporting", () => {
  test("one row per monitor and month over the last twelve complete months, without live months", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 1990, error: 10 }),
          frozen(api.id, "2026-10", { ok: 1984, degraded: 5, error: 11 }),
        ]);

      const calls: EpisodesCall[] = [];
      const res = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: episodesPipesFrom(() => [], calls),
      });
      // neither the running month nor an October older than 45 days is read
      expect(calls).toEqual([]);

      expect(res.filename).toBe("sla-partner-contract-2025-11-to-2026-10.csv");
      const { comments, header, rows } = parse(res.csv);
      expect(comments[0]).toBe(`# ${MONITOR_SLA_METHOD}`);
      expect(comments[1]).toContain(`Generated ${now.toISOString()}`);
      expect(comments[1]).toContain("Live months are not included.");
      expect(header).toBe(
        "reporting,target,strict,monitor_id,monitor_name,monitor_url,month,state,ok_runs,degraded_runs,failed_runs,excused_runs,uptime,met,sealed_at,method,time_zone,measured_ms,down_ms,excused_ms,unmeasured_ms,coverage",
      );
      expect(rows).toHaveLength(12);
      expect(rows[0]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2025-11,none,,,,,,,,,UTC,,,,,`,
      );
      expect(rows[10]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2026-09,preview,1990,0,10,0,99.500,yes,,runs,UTC,,,,,`,
      );
      expect(rows[11]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2026-10,preview,1984,5,11,0,99.450,no,,runs,UTC,,,,,`,
      );
    });
  });

  test("the figures equal the policy page", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx, { name: "A" });
      const b = await insertMonitor(tx, { name: "B", jobType: "tcp" });
      const policy = await insertPolicy(tx, [a.id, b.id], { strict: true });
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(a.id, "2026-08", { ok: 990, degraded: 7, error: 3 }),
          frozen(b.id, "2026-10", { ok: 2000, degraded: 1, error: 0 }),
        ]);
      await tx.insert(monitorSlaSealedMonth).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        monitorId: a.id,
        month: "2026-09-01",
        target: 99_000,
        strict: false,
        ok: 90,
        degraded: 0,
        error: 10,
        total: 100,
        up: 90,
        uptime: 90_000,
        met: false,
        sealedAt: new Date(Date.UTC(2026, 9, 4, 5, 47)),
      });

      const page = await getMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      const res = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      const { rows } = parse(res.csv);
      const cells = rows.map((r) => r.split(","));
      const expected = page.monitors.flatMap((m) =>
        m.months
          .filter((mm) => mm.state !== "live")
          .map((mm) => [
            String(m.id),
            mm.month.slice(0, 7),
            mm.state,
            mm.counts ? String(mm.counts.ok) : "",
            mm.counts ? String(mm.counts.degraded) : "",
            mm.counts ? String(mm.counts.error) : "",
            mm.uptime === null ? "" : (mm.uptime / 1000).toFixed(3),
            mm.met === null ? "" : mm.met ? "yes" : "no",
          ]),
      );
      expect(
        cells.map((c) => [c[3], c[6], c[7], c[8], c[9], c[10], c[12], c[13]]),
      ).toEqual(expected);

      const sealed = cells.find(
        (c) => c[3] === String(a.id) && c[6] === "2026-09",
      );
      // a sealed month carries the terms it was sealed with
      expect(sealed).toEqual([
        "Partner contract",
        "99.000",
        "no",
        String(a.id),
        "A",
        "https://example.com",
        "2026-09",
        "sealed",
        "90",
        "0",
        "10",
        "0",
        "90.000",
        "no",
        "2026-10-04T05:47:00.000Z",
        "runs",
        "UTC",
        "",
        "",
        "",
        "",
        "",
      ]);
      const strictPreview = cells.find(
        (c) => c[3] === String(a.id) && c[6] === "2026-08",
      );
      expect(strictPreview?.slice(1, 3)).toEqual(["99.500", "yes"]);
      expect(strictPreview?.[12]).toBe("99.000");
    });
  });

  test("live months only when asked for, marked provisional", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const outage = Date.UTC(2026, 10, 10);
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () =>
          runsEvery(Date.UTC(2026, 9, 1), now.getTime(), 10 * MIN, (t) =>
            t >= outage && t < outage + HOUR ? "error" : "ok",
          ),
        calls,
      );

      const without = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-11" },
        now,
        episodesPipes,
      });
      expect(calls).toEqual([]);
      expect(parse(without.csv).rows.map((r) => r.split(",")[6])).toEqual([
        "2026-10",
      ]);

      const withLive = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: {
          id: policy.id,
          from: "2026-10",
          to: "2026-11",
          includeLive: true,
        },
        now,
        episodesPipes,
        sleep,
      });
      const { comments, rows } = parse(withLive.csv);
      expect(comments[1]).toContain("Live months are provisional");
      expect(rows.at(-1)?.split(",").slice(6)).toEqual([
        "2026-11",
        "live (provisional)",
        "2082",
        "0",
        "6",
        "0",
        "99.712",
        "yes",
        "",
        "time",
        "UTC",
        String(14.5 * DAY),
        String(HOUR),
        "0",
        "0",
        "100.000",
      ]);
    });
  });

  test("the method states the gap rule the episodes use", () => {
    expect(MONITOR_SLA_METHOD).toContain(
      "more than twice the longer of the gaps before and after it",
    );
    expect(MONITOR_SLA_METHOD).not.toContain("twice the check interval");
  });

  test("runs that could not be loaded are named for a complete month too", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now: new Date(Date.UTC(2026, 10, 10)),
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      const { comments, rows } = parse(res.csv);
      expect(rows[0].split(",")[13]).toBe("");
      expect(comments[1]).toContain(
        "Runs could not be loaded for some monitors and months; those months have no judgement.",
      );
      expect(comments[1]).not.toContain("recent months are empty");
    });
  });

  test("a non-UTC policy exports months in its zone", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "America/New_York",
      });
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 1990, error: 10 }));
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () => runsEvery(Date.UTC(2026, 9, 1), now.getTime(), 10 * MIN),
        calls,
      );

      const res = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: {
          id: policy.id,
          from: "2026-10",
          to: "2026-11",
          includeLive: true,
        },
        now,
        episodesPipes,
        sleep,
      });
      const { comments, rows } = parse(res.csv);
      expect(comments[1]).toContain(
        "Months are calendar months in America/New_York.",
      );
      expect(comments[1]).toContain(
        "Unsealed months older than 45 days cannot be judged in America/New_York",
      );
      // midnight Nov 1 in New York is still EDT: the zone falls back at 2am
      expect(calls).toEqual([
        {
          monitorIds: [String(api.id)],
          fromDate: Date.UTC(2026, 10, 1, 4),
          toDate: now.getTime(),
          fallbackIntervalMs: 10 * MIN,
        },
      ]);
      const cells = rows.map((r) => r.split(","));
      expect(cells[0].slice(6)).toEqual([
        "2026-10",
        "none",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "America/New_York",
        "",
        "",
        "",
        "",
        "",
      ]);
      expect(cells[1].slice(6, 8)).toEqual(["2026-11", "live (provisional)"]);
      expect(cells[1].slice(15, 18)).toEqual([
        "time",
        "America/New_York",
        String(14 * DAY + 8 * HOUR),
      ]);
    });
  });

  test("escapes names for spreadsheets", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: '=HYPERLINK("x"), API' });
      const policy = await insertPolicy(tx, [api.id], { name: "EU, prod" });
      const res = await exportMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now,
      });
      expect(res.filename).toBe("sla-eu-prod-2026-10-to-2026-10.csv");
      expect(parse(res.csv).rows[0]).toBe(
        `"EU, prod",99.500,no,${api.id},"'=HYPERLINK(""x""), API",https://example.com,2026-10,none,,,,,,,,,UTC,,,,,`,
      );
    });
  });

  test("validates the range", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, []);
      const run = (input: { from?: string; to?: string }) =>
        exportMonitorReporting({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id, ...input },
          now,
        });
      await expect(
        run({ from: "2026-10", to: "2026-09" }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        run({ from: "2026-10", to: "2026-12" }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        run({ from: "2021-10", to: "2026-10" }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(run({ from: "2026-13" })).rejects.toThrow();
      // Date.UTC reads years 0-99 as 1900-1999
      await expect(run({ from: "0050-01", to: "0050-02" })).rejects.toThrow(
        /YYYY-MM/,
      );
      const ok = await run({ from: "2021-11", to: "2026-10" });
      expect(parse(ok.csv).rows).toEqual([]);
    });
  });

  test("a member can export", async () => {
    await withTestTransaction(async (tx) => {
      const member = await tx
        .insert(user)
        .values({ email: `sla-export-member-${Date.now()}@openstatus.dev` })
        .returning()
        .get();
      await tx.insert(usersToWorkspaces).values({
        userId: member.id,
        workspaceId: ctx.workspace.id,
        role: "member",
      });
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await exportMonitorReporting({
        ctx: { ...makeUserCtx(ctx.workspace, { userId: member.id }), db: tx },
        input: { id: policy.id },
        now,
      });
      expect(parse(res.csv).rows).toHaveLength(12);
    });
  });

  test("a read-only key can export", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, []);
      const key = makeApiKeyCtx(ctx.workspace, {
        keyId: "k",
        scopes: ["read"],
      });
      const res = await exportMonitorReporting({
        ctx: { ...key, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(parse(res.csv).rows).toEqual([]);
    });
  });

  test("refused without the limit", async () => {
    await expect(
      exportMonitorReporting({ ctx: freeCtx, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("another workspace's policy is not found", async () => {
    const other = await createWorkspaceFixture("team");
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, [], {
        workspaceId: other.workspace.id,
      });
      await expect(
        exportMonitorReporting({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
