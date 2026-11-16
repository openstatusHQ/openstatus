import {
  monitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
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
import { exportUptimeTarget, UPTIME_TARGET_METHOD } from "../export";
import { getUptimeTarget } from "../get";
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
  overrides: Partial<typeof uptimeTarget.$inferInsert> = {},
) {
  const policy = await tx
    .insert(uptimeTarget)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_500,
      ...overrides,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(uptimeTargetToMonitor).values(
      monitorIds.map((monitorId) => ({
        uptimeTargetId: policy.id,
        monitorId,
        createdAt: new Date(Date.UTC(2025, 0, 1)),
      })),
    );
  }
  return policy;
}

function parse(csv: string) {
  const lines = csv.trimEnd().split("\r\n");
  const comments = lines.filter((l) => l.startsWith("#"));
  const [header, ...rows] = lines.filter((l) => !l.startsWith("#"));
  return { comments, header, rows };
}

describe("exportUptimeTarget", () => {
  test("one row per monitor and month over the last twelve complete months, without live months", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);
      await tx.insert(uptimeTargetSealedMonth).values({
        workspaceId: ctx.workspace.id,
        uptimeTargetId: policy.id,
        monitorId: api.id,
        month: "2026-09-01",
        target: 99_500,
        strict: false,
        measuredMs: 2000 * 60_000,
        downMs: 10 * 60_000,
        excusedMs: 0,
        unmeasuredMs: 0,
        uptime: 99_500,
        met: true,
        sealedAt: new Date(Date.UTC(2026, 9, 4)),
      });

      const calls: EpisodesCall[] = [];
      const res = await exportUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: episodesPipesFrom(() => [], calls),
      });
      // neither the running month nor an October older than 45 days is read
      expect(calls).toEqual([]);

      expect(res.filename).toBe("sla-partner-contract-2025-11-to-2026-10.csv");
      const { comments, header, rows } = parse(res.csv);
      expect(comments[0]).toBe(`# ${UPTIME_TARGET_METHOD}`);
      expect(comments[1]).toContain(`Generated ${now.toISOString()}`);
      expect(comments[1]).toContain("Live months are not included.");
      expect(comments[1]).toContain(
        "Months that were never sealed and are no longer the running or previous month, or whose checks are no longer kept, have no judgement.",
      );
      expect(header).toBe(
        "uptime_target,target,strict,monitor_id,monitor_name,monitor_url,month,state,uptime,met,sealed_at,time_zone,measured_ms,down_ms,excused_ms,unmeasured_ms,coverage",
      );
      expect(rows).toHaveLength(12);
      expect(rows[0]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2025-11,none,,,,UTC,,,,,`,
      );
      expect(rows[10]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2026-09,sealed,99.500,yes,2026-10-04T00:00:00.000Z,UTC,120000000,600000,0,0,`,
      );
      expect(rows[11]).toBe(
        `Partner contract,99.500,no,${api.id},API,https://example.com,2026-10,none,,,,UTC,,,,,`,
      );
    });
  });

  test("the figures equal the policy page", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx, { name: "A" });
      const b = await insertMonitor(tx, { name: "B", jobType: "tcp" });
      const policy = await insertPolicy(tx, [a.id, b.id], { strict: true });
      await tx.insert(uptimeTargetSealedMonth).values({
        workspaceId: ctx.workspace.id,
        uptimeTargetId: policy.id,
        monitorId: a.id,
        month: "2026-09-01",
        target: 99_000,
        strict: false,
        measuredMs: 100 * 60_000,
        downMs: 10 * 60_000,
        excusedMs: 0,
        unmeasuredMs: 0,
        uptime: 90_000,
        met: false,
        sealedAt: new Date(Date.UTC(2026, 9, 4, 5, 47)),
      });

      const page = await getUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      const res = await exportUptimeTarget({
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
            mm.measuredMs === null ? "" : String(mm.measuredMs),
            mm.downMs === null ? "" : String(mm.downMs),
            mm.uptime === null ? "" : (mm.uptime / 1000).toFixed(3),
            mm.met === null ? "" : mm.met ? "yes" : "no",
          ]),
      );
      expect(
        cells.map((c) => [c[3], c[6], c[7], c[12], c[13], c[8], c[9]]),
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
        "90.000",
        "no",
        "2026-10-04T05:47:00.000Z",
        "UTC",
        String(100 * MIN),
        String(10 * MIN),
        "0",
        "0",
        "",
      ]);
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

      const without = await exportUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-11" },
        now,
        episodesPipes,
      });
      expect(calls).toEqual([]);
      expect(parse(without.csv).rows.map((r) => r.split(",")[6])).toEqual([
        "2026-10",
      ]);

      const withLive = await exportUptimeTarget({
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
        "99.712",
        "yes",
        "",
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
    expect(UPTIME_TARGET_METHOD).toContain(
      "more than twice the longer of the gaps before and after it",
    );
    expect(UPTIME_TARGET_METHOD).not.toContain("twice the check interval");
  });

  test("runs that could not be loaded are named for a complete month too", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await exportUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now: new Date(Date.UTC(2026, 10, 10)),
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      const { comments, rows } = parse(res.csv);
      expect(rows[0].split(",")[9]).toBe("");
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
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () => runsEvery(Date.UTC(2026, 9, 1), now.getTime(), 10 * MIN),
        calls,
      );

      const res = await exportUptimeTarget({
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
        "America/New_York",
        "",
        "",
        "",
        "",
        "",
      ]);
      expect(cells[1].slice(6, 8)).toEqual(["2026-11", "live (provisional)"]);
      expect(cells[1].slice(11, 13)).toEqual([
        "America/New_York",
        String(14 * DAY + 8 * HOUR),
      ]);
    });
  });

  test("escapes names for spreadsheets", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: '=HYPERLINK("x"), API' });
      const policy = await insertPolicy(tx, [api.id], { name: "EU, prod" });
      const res = await exportUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, from: "2026-10", to: "2026-10" },
        now,
      });
      expect(res.filename).toBe("sla-eu-prod-2026-10-to-2026-10.csv");
      expect(parse(res.csv).rows[0]).toBe(
        `"EU, prod",99.500,no,${api.id},"'=HYPERLINK(""x""), API",https://example.com,2026-10,none,,,,UTC,,,,,`,
      );
    });
  });

  test("validates the range", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, []);
      const run = (input: { from?: string; to?: string }) =>
        exportUptimeTarget({
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
      const res = await exportUptimeTarget({
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
      const res = await exportUptimeTarget({
        ctx: { ...key, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(parse(res.csv).rows).toEqual([]);
    });
  });

  test("refused without the limit", async () => {
    await expect(
      exportUptimeTarget({ ctx: freeCtx, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("another workspace's policy is not found", async () => {
    const other = await createWorkspaceFixture("team");
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, [], {
        workspaceId: other.workspace.id,
      });
      await expect(
        exportUptimeTarget({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
