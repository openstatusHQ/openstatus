import { eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorUptimeEpisode,
  monitorUptimeWatermark,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { Episode } from "../episodes";
import {
  sealMonitorUptime,
  storedEpisodes,
  tileStoredEpisodes,
  UPTIME_SEAL_LAG_MS,
  UPTIME_SEAL_MARGIN_MS,
  UPTIME_SEAL_MAX_RANGE_MS,
  uptimeEpisodesToStore,
  uptimeSealRange,
} from "../seal-uptime";
import {
  type EpisodesCall,
  episodesPipesFrom,
  failingEpisodesPipes,
  type Run,
  runsEvery,
} from "./fixtures/episodes-pipes";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const STEP = 10 * MIN;
const at = (month: number, d: number, h = 0, m = 0) =>
  Date.UTC(2026, month, d, h, m);

describe("tileStoredEpisodes", () => {
  const watermark = { sealedFrom: 1_000, sealedUntil: 9_000 };
  const row = (kind: Episode["kind"], startedAt: number, endedAt: number) => ({
    kind,
    startedAt,
    endedAt,
  });
  // the store as the job leaves it: rows tiling the watermark range
  const rows = [
    row("ok", 1_000, 3_000),
    row("error", 3_000, 4_000),
    row("ok", 4_000, 6_000),
    row("unmeasured", 6_000, 7_000),
    row("degraded", 7_000, 7_500),
    row("ok", 7_500, 9_000),
  ];

  test("is not ready without a watermark, or when it stops short of the range's end", () => {
    const args = { rows: [row("ok", 0, 3_000)], fromMs: 2_000, toMs: 3_000 };
    expect(tileStoredEpisodes({ ...args, watermark: undefined })).toBeNull();
    expect(
      tileStoredEpisodes({
        ...args,
        watermark: { sealedFrom: 0, sealedUntil: 2_999 },
      }),
    ).toBeNull();
    expect(
      tileStoredEpisodes({
        ...args,
        watermark: { sealedFrom: 0, sealedUntil: 3_000 },
      }),
    ).toEqual([{ kind: "ok", startedAt: 2_000, endedAt: 3_000 }]);
  });

  test("reads the rows of the range as they are, in order", () => {
    expect(
      tileStoredEpisodes({
        watermark,
        rows: [...rows].reverse(),
        fromMs: 1_000,
        toMs: 9_000,
      }),
    ).toEqual(rows);
  });

  test("clips the rows that cross the range's edges and drops the ones outside", () => {
    expect(
      tileStoredEpisodes({ watermark, rows, fromMs: 3_500, toMs: 7_200 }),
    ).toEqual([
      { kind: "error", startedAt: 3_500, endedAt: 4_000 },
      { kind: "ok", startedAt: 4_000, endedAt: 6_000 },
      { kind: "unmeasured", startedAt: 6_000, endedAt: 7_000 },
      { kind: "degraded", startedAt: 7_000, endedAt: 7_200 },
    ]);
  });

  test("the part before the store begins is unmeasured", () => {
    expect(
      tileStoredEpisodes({ watermark, rows, fromMs: 0, toMs: 3_500 }),
    ).toEqual([
      { kind: "unmeasured", startedAt: 0, endedAt: 1_000 },
      { kind: "ok", startedAt: 1_000, endedAt: 3_000 },
      { kind: "error", startedAt: 3_000, endedAt: 3_500 },
    ]);
  });

  test("a row reaching before the store's start counts from that start only", () => {
    expect(
      tileStoredEpisodes({
        watermark,
        rows: [row("ok", 0, 9_000)],
        fromMs: 500,
        toMs: 2_000,
      }),
    ).toEqual([
      { kind: "unmeasured", startedAt: 500, endedAt: 1_000 },
      { kind: "ok", startedAt: 1_000, endedAt: 2_000 },
    ]);
  });

  test("a range wholly before the store begins is unmeasured", () => {
    expect(
      tileStoredEpisodes({ watermark, rows, fromMs: 0, toMs: 500 }),
    ).toEqual([{ kind: "unmeasured", startedAt: 0, endedAt: 500 }]);
  });

  test("a hole the rows leave inside the watermark range is unmeasured, never ok", () => {
    expect(
      tileStoredEpisodes({
        watermark,
        rows: [row("ok", 1_000, 3_000), row("error", 5_000, 6_000)],
        fromMs: 2_000,
        toMs: 8_000,
      }),
    ).toEqual([
      { kind: "ok", startedAt: 2_000, endedAt: 3_000 },
      { kind: "unmeasured", startedAt: 3_000, endedAt: 5_000 },
      { kind: "error", startedAt: 5_000, endedAt: 6_000 },
      { kind: "unmeasured", startedAt: 6_000, endedAt: 8_000 },
    ]);
    expect(
      tileStoredEpisodes({ watermark, rows: [], fromMs: 2_000, toMs: 8_000 }),
    ).toEqual([{ kind: "unmeasured", startedAt: 2_000, endedAt: 8_000 }]);
  });

  test("overlapping rows count their time once", () => {
    expect(
      tileStoredEpisodes({
        watermark,
        rows: [row("ok", 1_000, 5_000), row("error", 4_000, 6_000)],
        fromMs: 1_000,
        toMs: 6_000,
      }),
    ).toEqual([
      { kind: "ok", startedAt: 1_000, endedAt: 5_000 },
      { kind: "error", startedAt: 5_000, endedAt: 6_000 },
    ]);
  });

  test("merges adjacent episodes of the same kind", () => {
    expect(
      tileStoredEpisodes({
        watermark,
        rows: [
          row("unmeasured", 1_000, 2_000),
          row("ok", 2_000, 4_000),
          row("ok", 4_000, 5_000),
          row("error", 5_000, 6_000),
        ],
        fromMs: 0,
        toMs: 6_000,
      }),
    ).toEqual([
      { kind: "unmeasured", startedAt: 0, endedAt: 2_000 },
      { kind: "ok", startedAt: 2_000, endedAt: 5_000 },
      { kind: "error", startedAt: 5_000, endedAt: 6_000 },
    ]);
  });

  test("tiles any range exactly", () => {
    for (const [fromMs, toMs] of [
      [0, 9_000],
      [700, 8_999],
      [3_000, 3_001],
      [6_500, 7_250],
    ]) {
      const tiles = tileStoredEpisodes({ watermark, rows, fromMs, toMs }) ?? [];
      expect(tiles[0].startedAt).toBe(fromMs);
      expect(tiles.at(-1)?.endedAt).toBe(toMs);
      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i].startedAt).toBe(tiles[i - 1].endedAt);
        expect(tiles[i].kind).not.toBe(tiles[i - 1].kind);
      }
    }
  });

  test("an empty range has no episodes", () => {
    expect(
      tileStoredEpisodes({ watermark, rows, fromMs: 2_000, toMs: 2_000 }),
    ).toEqual([]);
  });
});

describe("uptimeSealRange", () => {
  const until = at(10, 10);
  const oldest = until - UPTIME_SEAL_MAX_RANGE_MS;

  test("a first run starts at the monitor's creation, at most the longest range back", () => {
    expect(
      uptimeSealRange({ watermark: undefined, createdAt: 0, until }),
    ).toEqual({ from: oldest, gap: null });
    expect(
      uptimeSealRange({
        watermark: undefined,
        createdAt: until - DAY,
        until,
      }),
    ).toEqual({ from: until - DAY, gap: null });
    expect(
      uptimeSealRange({ watermark: undefined, createdAt: until, until }),
    ).toBeNull();
  });

  test("a later run continues from the watermark", () => {
    const watermark = { sealedFrom: oldest, sealedUntil: until - DAY };
    expect(uptimeSealRange({ watermark, createdAt: 0, until })).toEqual({
      from: until - DAY,
      gap: null,
    });
    expect(
      uptimeSealRange({
        watermark: { ...watermark, sealedUntil: until },
        createdAt: 0,
        until,
      }),
    ).toBeNull();
  });

  test("a watermark older than the longest range leaves an unmeasured gap", () => {
    const watermark = { sealedFrom: 0, sealedUntil: oldest - 5 * DAY };
    expect(uptimeSealRange({ watermark, createdAt: 0, until })).toEqual({
      from: oldest,
      gap: {
        kind: "unmeasured",
        startedAt: oldest - 5 * DAY,
        endedAt: oldest,
      },
    });
  });
});

describe("uptimeEpisodesToStore", () => {
  test("keeps every episode inside the range, ok included, the gap first", () => {
    expect(
      uptimeEpisodesToStore({
        episodes: [
          { kind: "unmeasured", startedAt: 0, endedAt: 150 },
          { kind: "ok", startedAt: 150, endedAt: 300 },
          { kind: "error", startedAt: 300, endedAt: 500 },
        ],
        gap: { kind: "unmeasured", startedAt: 40, endedAt: 100 },
        from: 100,
        until: 400,
      }),
    ).toEqual([
      { kind: "unmeasured", startedAt: 40, endedAt: 150 },
      { kind: "ok", startedAt: 150, endedAt: 300 },
      { kind: "error", startedAt: 300, endedAt: 400 },
    ]);
  });
});

describe("sealMonitorUptime", () => {
  // the run of Nov 10 12:30 stores up to Nov 9 12:00
  const now = new Date(at(10, 10, 12, 30));
  const until = at(10, 9, 12);
  const oldest = until - UPTIME_SEAL_MAX_RANGE_MS;
  const sleep = async () => {};

  let teamWorkspaceId: number;
  let freeWorkspaceId: number;

  beforeAll(async () => {
    teamWorkspaceId = (await createWorkspaceFixture("team")).workspace.id;
    freeWorkspaceId = (await createWorkspaceFixture("free")).workspace.id;
  });

  type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

  async function insertPolicy(
    tx: Tx,
    monitorIds: number[],
    overrides: Partial<typeof monitorSlaPolicy.$inferInsert> = {},
  ) {
    const policy = await tx
      .insert(monitorSlaPolicy)
      .values({
        workspaceId: teamWorkspaceId,
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
        })),
      );
    }
    return policy;
  }

  /** A monitor in one reporting of its workspace, unless `reporting` is false. */
  async function insertMonitor(
    tx: Tx,
    overrides: Partial<typeof monitor.$inferInsert> = {},
    reporting = true,
  ) {
    const row = await tx
      .insert(monitor)
      .values({
        workspaceId: teamWorkspaceId,
        active: true,
        url: "https://example.com",
        name: "svc-uptime-seal",
        periodicity: "10m",
        regions: "ams",
        jobType: "http",
        createdAt: new Date(at(0, 1)),
        ...overrides,
      })
      .returning()
      .get();
    if (reporting) {
      await insertPolicy(tx, [row.id], {
        workspaceId: row.workspaceId ?? teamWorkspaceId,
      });
    }
    return row;
  }

  /** Runs every 10 minutes from Sep 1 to Dec 31; `verdict` labels each, null drops it. */
  function runs(verdict: (t: number) => Run["verdict"] | null = () => "ok") {
    return runsEvery(at(8, 1), at(11, 31), STEP).flatMap((r) => {
      const v = verdict(r.cronTimestamp);
      return v ? [{ ...r, verdict: v }] : [];
    });
  }

  const inSpan = (t: number, from: number, to: number) => from <= t && t < to;

  async function stored(tx: Tx, monitorId: number) {
    const rows = await tx
      .select()
      .from(monitorUptimeEpisode)
      .where(eq(monitorUptimeEpisode.monitorId, monitorId))
      .orderBy(monitorUptimeEpisode.startedAt)
      .all();
    return rows.map(({ kind, startedAt, endedAt }) => ({
      kind,
      startedAt,
      endedAt,
    }));
  }

  async function watermarkOf(tx: Tx, monitorId: number) {
    const row = await tx
      .select()
      .from(monitorUptimeWatermark)
      .where(eq(monitorUptimeWatermark.monitorId, monitorId))
      .get();
    return row
      ? { sealedFrom: row.sealedFrom, sealedUntil: row.sealedUntil }
      : null;
  }

  test("a first run stores the last 40 days up to a day ago, ok time included", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes: episodesPipesFrom(
          () =>
            runs((t) =>
              inSpan(t, at(9, 20, 22), at(9, 20, 23))
                ? "error"
                : inSpan(t, at(9, 25, 3), at(9, 25, 4))
                  ? "degraded"
                  : // too late to be stored by this run
                    inSpan(t, until + HOUR, until + 2 * HOUR)
                    ? "error"
                    : "ok",
            ),
          calls,
        ),
        sleep,
      });

      expect(res).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(until).toBe(
        Math.floor((now.getTime() - UPTIME_SEAL_LAG_MS) / HOUR) * HOUR,
      );
      expect(calls).toEqual([
        {
          monitorIds: [String(api.id)],
          fromDate: oldest - UPTIME_SEAL_MARGIN_MS,
          toDate: now.getTime(),
          fallbackIntervalMs: STEP,
        },
      ]);
      expect(await watermarkOf(tx, api.id)).toEqual({
        sealedFrom: oldest,
        sealedUntil: until,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: at(9, 20, 22) },
        { kind: "error", startedAt: at(9, 20, 22), endedAt: at(9, 20, 23) },
        { kind: "ok", startedAt: at(9, 20, 23), endedAt: at(9, 25, 3) },
        { kind: "degraded", startedAt: at(9, 25, 3), endedAt: at(9, 25, 4) },
        { kind: "ok", startedAt: at(9, 25, 4), endedAt: until },
      ]);
    });
  });

  test("a monitor created inside the range is stored from its creation", async () => {
    await withTestTransaction(async (tx) => {
      const created = at(10, 1, 6, 20);
      const api = await insertMonitor(tx, { createdAt: new Date(created) });
      await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes: episodesPipesFrom(() =>
          runs((t) => (t < created ? null : "ok")),
        ),
        sleep,
      });
      expect(await watermarkOf(tx, api.id)).toEqual({
        sealedFrom: created,
        sealedUntil: until,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: created, endedAt: until },
      ]);
    });
  });

  test("a later run stores only what is new, and a rerun stores nothing twice", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const outage = until + 6 * HOUR;
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () =>
          runs((t) =>
            inSpan(t, at(9, 20, 22), at(9, 20, 23)) ||
            inSpan(t, outage, outage + HOUR)
              ? "error"
              : "ok",
          ),
        calls,
      );
      const run = (t: number) =>
        sealMonitorUptime({
          db: tx,
          now: new Date(t),
          monitorIds: [api.id],
          episodesPipes,
          sleep,
        });
      await run(now.getTime());
      calls.length = 0;

      expect(await run(now.getTime() + DAY)).toEqual({
        sealed: 1,
        failed: 0,
        skipped: 0,
      });
      expect(calls).toMatchObject([
        {
          fromDate: until - UPTIME_SEAL_MARGIN_MS,
          toDate: now.getTime() + DAY,
        },
      ]);
      expect(await watermarkOf(tx, api.id)).toEqual({
        sealedFrom: oldest,
        sealedUntil: until + DAY,
      });
      const afterSecond = await stored(tx, api.id);
      expect(afterSecond).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: at(9, 20, 22) },
        { kind: "error", startedAt: at(9, 20, 22), endedAt: at(9, 20, 23) },
        { kind: "ok", startedAt: at(9, 20, 23), endedAt: outage },
        { kind: "error", startedAt: outage, endedAt: outage + HOUR },
        { kind: "ok", startedAt: outage + HOUR, endedAt: until + DAY },
      ]);

      calls.length = 0;
      expect(await run(now.getTime() + DAY)).toEqual({
        sealed: 0,
        failed: 0,
        skipped: 1,
      });
      expect(calls).toEqual([]);
      expect(await stored(tx, api.id)).toEqual(afterSecond);
    });
  });

  test("a failed read leaves the watermark where it was", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const never = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(never).toEqual({ sealed: 0, failed: 1, skipped: 0 });
      expect(await watermarkOf(tx, api.id)).toBeNull();

      const episodesPipes = episodesPipesFrom(() => runs());
      await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes,
        sleep,
      });
      const later = await sealMonitorUptime({
        db: tx,
        now: new Date(now.getTime() + DAY),
        monitorIds: [api.id],
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(later).toEqual({ sealed: 0, failed: 1, skipped: 0 });
      expect(await watermarkOf(tx, api.id)).toEqual({
        sealedFrom: oldest,
        sealedUntil: until,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: until },
      ]);

      // the next run that can read catches up over both days
      const caughtUp = await sealMonitorUptime({
        db: tx,
        now: new Date(now.getTime() + 2 * DAY),
        monitorIds: [api.id],
        episodesPipes,
        sleep,
      });
      expect(caughtUp).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect((await watermarkOf(tx, api.id))?.sealedUntil).toBe(
        until + 2 * DAY,
      );
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: until + 2 * DAY },
      ]);
    });
  });

  test("after a long pause the time whose checks are gone is stored as unmeasured", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      // last stored on Aug 1; by Nov 10 the checks before Sep 30 12:00 are out of reach
      await tx.insert(monitorUptimeWatermark).values({
        workspaceId: teamWorkspaceId,
        monitorId: api.id,
        sealedFrom: at(6, 1),
        sealedUntil: at(7, 1),
      });
      await tx.insert(monitorUptimeEpisode).values({
        workspaceId: teamWorkspaceId,
        monitorId: api.id,
        kind: "ok",
        startedAt: at(6, 1),
        endedAt: at(7, 1),
      });
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes: episodesPipesFrom(() => runs(), calls),
        sleep,
      });

      expect(res).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(calls).toMatchObject([
        { fromDate: oldest - UPTIME_SEAL_MARGIN_MS },
      ]);
      expect(await watermarkOf(tx, api.id)).toEqual({
        sealedFrom: at(6, 1),
        sealedUntil: until,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: at(6, 1), endedAt: at(7, 1) },
        { kind: "unmeasured", startedAt: at(7, 1), endedAt: oldest },
        { kind: "ok", startedAt: oldest, endedAt: until },
      ]);
      expect(
        (await storedEpisodes(tx, [api.id], at(6, 15), until)).get(api.id),
      ).toEqual([
        { kind: "ok", startedAt: at(6, 15), endedAt: at(7, 1) },
        { kind: "unmeasured", startedAt: at(7, 1), endedAt: oldest },
        { kind: "ok", startedAt: oldest, endedAt: until },
      ]);
    });
  });

  test("a healthy monitor keeps one ok row that grows with every run", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const episodesPipes = episodesPipesFrom(() => runs());
      for (const days of [0, 1, 2, 3]) {
        await sealMonitorUptime({
          db: tx,
          now: new Date(now.getTime() + days * DAY),
          monitorIds: [api.id],
          episodesPipes,
          sleep,
        });
        expect(await stored(tx, api.id)).toEqual([
          { kind: "ok", startedAt: oldest, endedAt: until + days * DAY },
        ]);
      }
    });
  });

  test("an outage that runs across two runs is one stored episode", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const outage = { start: until - 2 * HOUR, end: until + 3 * HOUR };
      const episodesPipes = episodesPipesFrom(() =>
        runs((t) => (inSpan(t, outage.start, outage.end) ? "error" : "ok")),
      );
      await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes,
        sleep,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: outage.start },
        { kind: "error", startedAt: outage.start, endedAt: until },
      ]);

      await sealMonitorUptime({
        db: tx,
        now: new Date(now.getTime() + DAY),
        monitorIds: [api.id],
        episodesPipes,
        sleep,
      });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: outage.start },
        { kind: "error", startedAt: outage.start, endedAt: outage.end },
        { kind: "ok", startedAt: outage.end, endedAt: until + DAY },
      ]);
    });
  });

  test("a different kind at the watermark starts a new episode", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const episodesPipes = episodesPipesFrom(() =>
        runs((t) =>
          inSpan(t, until - HOUR, until)
            ? "error"
            : inSpan(t, until, until + HOUR)
              ? "degraded"
              : "ok",
        ),
      );
      for (const t of [now.getTime(), now.getTime() + DAY]) {
        await sealMonitorUptime({
          db: tx,
          now: new Date(t),
          monitorIds: [api.id],
          episodesPipes,
          sleep,
        });
      }
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: until - HOUR },
        { kind: "error", startedAt: until - HOUR, endedAt: until },
        { kind: "degraded", startedAt: until, endedAt: until + HOUR },
        { kind: "ok", startedAt: until + HOUR, endedAt: until + DAY },
      ]);
    });
  });

  test("a monitor in no active reporting is not sealed", async () => {
    await withTestTransaction(async (tx) => {
      const member = await insertMonitor(tx);
      const loose = await insertMonitor(tx, {}, false);
      const archivedOnly = await insertMonitor(tx, {}, false);
      await insertPolicy(tx, [archivedOnly.id], { archivedAt: new Date() });
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [member.id, loose.id, archivedOnly.id],
        episodesPipes: episodesPipesFrom(() => runs(), calls),
        sleep,
      });

      expect(res).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(calls.flatMap((c) => c.monitorIds)).toEqual([String(member.id)]);
      expect(await watermarkOf(tx, member.id)).not.toBeNull();
      for (const m of [loose, archivedOnly]) {
        expect(await watermarkOf(tx, m.id)).toBeNull();
        expect(await stored(tx, m.id)).toEqual([]);
      }
    });
  });

  test("a monitor that left its reportings stops being sealed, and continues from its watermark when it rejoins", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, {}, false);
      const policy = await insertPolicy(tx, [api.id]);
      const episodesPipes = episodesPipesFrom(() => runs());
      const run = (days: number) =>
        sealMonitorUptime({
          db: tx,
          now: new Date(now.getTime() + days * DAY),
          monitorIds: [api.id],
          episodesPipes,
          sleep,
        });
      await run(0);
      await tx
        .delete(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id));

      expect(await run(1)).toEqual({ sealed: 0, failed: 0, skipped: 0 });
      expect((await watermarkOf(tx, api.id))?.sealedUntil).toBe(until);

      await insertPolicy(tx, [api.id]);
      expect(await run(3)).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: until + 3 * DAY },
      ]);
    });
  });

  test("a monitor in two reportings is stored once", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      await insertPolicy(tx, [api.id], { strict: true });
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id],
        episodesPipes: episodesPipesFrom(
          () =>
            runs((t) =>
              inSpan(t, at(9, 20, 22), at(9, 20, 23)) ? "error" : "ok",
            ),
          calls,
        ),
        sleep,
      });

      expect(res).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(calls.map((c) => c.monitorIds)).toEqual([[String(api.id)]]);
      expect(await stored(tx, api.id)).toEqual([
        { kind: "ok", startedAt: oldest, endedAt: at(9, 20, 22) },
        { kind: "error", startedAt: at(9, 20, 22), endedAt: at(9, 20, 23) },
        { kind: "ok", startedAt: at(9, 20, 23), endedAt: until },
      ]);
    });
  });

  test("skips workspaces without the limit, deleted monitors and types without run verdicts", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const free = await insertMonitor(tx, { workspaceId: freeWorkspaceId });
      const deleted = await insertMonitor(tx, { deletedAt: new Date() });
      const heartbeat = await insertMonitor(tx, { jobType: "heartbeat" });
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [api.id, free.id, deleted.id, heartbeat.id],
        episodesPipes: episodesPipesFrom(() => runs(), calls),
        sleep,
      });

      expect(res).toEqual({ sealed: 1, failed: 0, skipped: 0 });
      expect(calls.flatMap((c) => c.monitorIds)).toEqual([String(api.id)]);
      expect(await watermarkOf(tx, api.id)).not.toBeNull();
      for (const m of [free, deleted, heartbeat]) {
        expect(await watermarkOf(tx, m.id)).toBeNull();
      }
    });
  });

  test("monitors of one run share a pipe call per type", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx);
      const b = await insertMonitor(tx);
      const calls: EpisodesCall[] = [];
      const res = await sealMonitorUptime({
        db: tx,
        now,
        monitorIds: [a.id, b.id],
        episodesPipes: episodesPipesFrom(() => runs(), calls),
        sleep,
      });
      expect(res.sealed).toBe(2);
      expect(calls).toHaveLength(1);
      expect([...calls[0].monitorIds].sort()).toEqual(
        [String(a.id), String(b.id)].sort(),
      );
    });
  });
});

describe("storedEpisodes", () => {
  let workspaceId: number;

  beforeAll(async () => {
    workspaceId = (await createWorkspaceFixture("team")).workspace.id;
  });

  test("answers per monitor: not ready, or a tiling of the range", async () => {
    await withTestTransaction(async (tx) => {
      const [ready, short, never] = await tx
        .insert(monitor)
        .values(
          ["ready", "short", "never"].map((name) => ({
            workspaceId,
            active: true,
            url: "https://example.com",
            name,
            periodicity: "10m" as const,
            regions: "ams",
            jobType: "http" as const,
          })),
        )
        .returning();
      const from = at(9, 1);
      const to = at(10, 1);
      await tx.insert(monitorUptimeWatermark).values([
        { workspaceId, monitorId: ready.id, sealedFrom: 0, sealedUntil: to },
        {
          workspaceId,
          monitorId: short.id,
          sealedFrom: 0,
          sealedUntil: to - 1,
        },
      ]);
      await tx.insert(monitorUptimeEpisode).values([
        {
          workspaceId,
          monitorId: ready.id,
          kind: "error",
          startedAt: from - HOUR,
          endedAt: from + HOUR,
        },
        {
          workspaceId,
          monitorId: ready.id,
          kind: "ok",
          startedAt: from + HOUR,
          endedAt: to,
        },
        {
          workspaceId,
          monitorId: ready.id,
          kind: "degraded",
          startedAt: to,
          endedAt: to + HOUR,
        },
        {
          workspaceId,
          monitorId: short.id,
          kind: "error",
          startedAt: from,
          endedAt: from + HOUR,
        },
      ]);

      const res = await storedEpisodes(
        tx,
        [ready.id, short.id, never.id, ready.id],
        from,
        to,
      );
      expect([...res.keys()]).toEqual([ready.id, short.id, never.id]);
      expect(res.get(ready.id)).toEqual([
        { kind: "error", startedAt: from, endedAt: from + HOUR },
        { kind: "ok", startedAt: from + HOUR, endedAt: to },
      ]);
      expect(res.get(short.id)).toBeNull();
      expect(res.get(never.id)).toBeNull();
    });
  });
});
