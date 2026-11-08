import { db, eq } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import {
  floorPct,
  roundCount,
  tallyBuckets,
  todayIn,
} from "@openstatus/services/status-timeline";
import { NextRequest } from "next/server.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

type Params = {
  monitorIds?: string[];
  timezone?: string;
  monitorId?: string;
  interval?: number;
  fromDate?: string;
  toDate?: string;
};
type Pipe = (params: Params) => Promise<{ data: unknown[] }>;

const pipes = vi.hoisted(() => ({
  impl: new Map<string, Pipe>(),
  calls: [] as { name: string; params: Params }[],
}));

vi.mock("../tb", () => ({
  tb: new Proxy(
    {},
    {
      get: (_, name: string) => (params: Params) => {
        pipes.calls.push({ name, params });
        return pipes.impl.get(name)?.(params) ?? Promise.resolve({ data: [] });
      },
    },
  ),
}));

const SIX_REGIONS = "ams,fra,iad,gru,syd,hkg";

let workspaceId: number;
let locationId: number;
const ids = {} as Record<"cloud" | "private", number>;

function caller() {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal"),
      session: null,
    }),
  );
}

// `n` days before today in the zone, keyed as UTC midnight like every day-keyed row
function daysAgoIn(timeZone: string, n: number) {
  const day = todayIn(timeZone);
  day.setUTCDate(day.getUTCDate() - n);
  return day.toISOString();
}

function yesterdayIn(timeZone: string) {
  return daysAgoIn(timeZone, 1);
}

function counts(
  monitorId: number,
  day: string,
  c: { ok: number; error: number },
) {
  return {
    day,
    monitorId: String(monitorId),
    count: c.ok + c.error,
    ok: c.ok,
    degraded: 0,
    error: c.error,
  };
}

function hist(
  monitorId: number,
  day: string,
  b: { errorRegions: number; notOkRegions: number; runs: number },
) {
  return { day, monitorId: String(monitorId), private: false, ...b };
}

async function pageWith(monitorId: number, defaultTimezone = "UTC") {
  const _page = await createPage(workspaceId, { defaultTimezone });
  const component = await createPageComponent(workspaceId, _page.id, {
    type: "monitor",
    monitorId,
  });
  return { slug: _page.slug, componentId: component.id };
}

async function uptime(slug: string, componentId: number) {
  const result = await caller().statusPage.getUptime({
    slug,
    pageComponentIds: [String(componentId)],
  });
  const component = result?.find((c) => c.pageComponentId === componentId);
  if (!component) throw new Error("component missing");
  return component;
}

function cardCounts(card: { status: string; value: string }[]) {
  const out: Record<string, number> = {};
  for (const c of card) out[c.status] = Number.parseInt(c.value, 10);
  return out;
}

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspaceId = fixture.workspace.id;
  ids.cloud = (
    await createMonitor(workspaceId, {
      active: true,
      jobType: "http",
      regions: SIX_REGIONS,
    })
  ).id;
  ids.private = (
    await createMonitor(workspaceId, {
      active: true,
      jobType: "http",
      regions: "",
    })
  ).id;
  const location = await db
    .insert(privateLocation)
    .values({
      name: "quorum-test",
      token: `quorum-${workspaceId}`,
      workspaceId,
    })
    .returning()
    .get();
  locationId = location.id;
  await db
    .insert(privateLocationToMonitors)
    .values({ privateLocationId: locationId, monitorId: ids.private });
});

beforeEach(() => {
  pipes.impl.clear();
  pipes.calls.length = 0;
});

afterAll(async () => {
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.workspaceId, workspaceId));
  await db.delete(page).where(eq(page.workspaceId, workspaceId));
  await db
    .delete(privateLocationToMonitors)
    .where(eq(privateLocationToMonitors.privateLocationId, locationId));
  await db.delete(privateLocation).where(eq(privateLocation.id, locationId));
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId));
});

describe("getUptime counts runs for monitors with a quorum population", () => {
  test("UTC page: 1 of 6 regions failing all day is a green day in runs at 100%", async () => {
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.cloud, day, { ok: 720, error: 144 })],
    }));
    pipes.impl.set("httpQuorum45d", async () => ({
      data: [
        hist(ids.cloud, day, { errorRegions: 1, notOkRegions: 1, runs: 144 }),
      ],
    }));
    const { slug, componentId } = await pageWith(ids.cloud);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);

    expect(bar?.bar).toEqual([{ status: "success", height: 100 }]);
    expect(bar?.card).toEqual([{ status: "success", value: "144 checks" }]);
    expect(component.uptime).toBe("100%");
    expect(pipes.calls.find((c) => c.name === "httpQuorum45d")?.params).toEqual(
      { monitorIds: [String(ids.cloud)] },
    );
  });

  test("3 of 6 failing in some runs: those runs are errors and the % matches the cards", async () => {
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.cloud, day, { ok: 852, error: 12 })],
    }));
    pipes.impl.set("httpQuorum45d", async () => ({
      data: [
        hist(ids.cloud, day, { errorRegions: 0, notOkRegions: 0, runs: 140 }),
        hist(ids.cloud, day, { errorRegions: 3, notOkRegions: 3, runs: 4 }),
      ],
    }));
    const { slug, componentId } = await pageWith(ids.cloud);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);
    const shown = cardCounts(bar?.card ?? []);

    expect(bar?.card).toEqual([
      { status: "success", value: "140 checks" },
      { status: "error", value: "4 checks" },
    ]);
    expect(bar?.bar).toEqual([{ status: "error", height: 100 }]);
    expect(component.uptime).toBe(
      `${floorPct(shown.success / (shown.success + shown.error))}%`,
    );
    expect(component.uptime).toBe("97.222%");
  });

  test("non-UTC page: quorum is read in the page zone and lands on its local day", async () => {
    const zone = "Pacific/Kiritimati";
    const localDay = yesterdayIn(zone);
    pipes.impl.set("httpStatus15m", async () => ({
      data: [counts(ids.cloud, localDay, { ok: 720, error: 144 })],
    }));
    pipes.impl.set("httpQuorum45d", async ({ timezone }) => ({
      data:
        timezone === zone
          ? [
              hist(ids.cloud, localDay, {
                errorRegions: 1,
                notOkRegions: 1,
                runs: 144,
              }),
            ]
          : [],
    }));
    const { slug, componentId } = await pageWith(ids.cloud, zone);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === localDay);

    expect(component.timeZone).toBe(zone);
    expect(bar?.card).toEqual([{ status: "success", value: "144 checks" }]);
    expect(component.uptime).toBe("100%");
    expect(pipes.calls.find((c) => c.name === "httpQuorum45d")?.params).toEqual(
      { monitorIds: [String(ids.cloud)], timezone: zone },
    );
  });

  test("counts falling back to UTC days drop quorum read in the page zone and convert to runs", async () => {
    const zone = "Pacific/Kiritimati";
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus15m", async () => {
      throw new Error("Invalid time zone");
    });
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.cloud, day, { ok: 720, error: 144 })],
    }));
    pipes.impl.set("httpQuorum45d", async () => ({
      data: [
        hist(ids.cloud, day, { errorRegions: 1, notOkRegions: 1, runs: 144 }),
      ],
    }));
    const { slug, componentId } = await pageWith(ids.cloud, zone);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);

    expect(component.timeZone).toBe("UTC");
    expect(bar?.card).toEqual([
      { status: "success", value: "120 checks" },
      { status: "error", value: "24 checks" },
    ]);
  });

  test("days lacking quorum in the window are converted, so cards and % share one unit", async () => {
    const withQuorum = yesterdayIn("UTC");
    const legacy = daysAgoIn("UTC", 30);
    pipes.impl.set("httpStatus45d", async () => ({
      data: [
        counts(ids.cloud, withQuorum, { ok: 852, error: 12 }),
        counts(ids.cloud, legacy, { ok: 540, error: 60 }),
      ],
    }));
    pipes.impl.set("httpQuorum45d", async () => ({
      data: [
        hist(ids.cloud, withQuorum, {
          errorRegions: 0,
          notOkRegions: 0,
          runs: 140,
        }),
        hist(ids.cloud, withQuorum, {
          errorRegions: 3,
          notOkRegions: 3,
          runs: 4,
        }),
      ],
    }));
    const { slug, componentId } = await pageWith(ids.cloud);

    const component = await uptime(slug, componentId);
    const runsDay = component.data.find((d) => d.day === withQuorum);
    const legacyDay = component.data.find((d) => d.day === legacy);

    expect(runsDay?.card).toEqual([
      { status: "success", value: "140 checks" },
      { status: "error", value: "4 checks" },
    ]);
    expect(legacyDay?.card).toEqual([
      { status: "success", value: "90 checks" },
      { status: "error", value: "10 checks" },
    ]);
    const up = 140 + 90;
    const total = 144 + 100;
    expect(component.uptime).toBe(`${floorPct(up / total)}%`);
    expect(component.uptime).not.toBe(
      `${floorPct((140 + 540) / (144 + 600))}%`,
    );
  });

  test("a converted day rounds its card counts at display", async () => {
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.cloud, day, { ok: 857, error: 7 })],
    }));
    const { slug, componentId } = await pageWith(ids.cloud);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);

    expect(bar?.card).toEqual([
      { status: "success", value: "143 checks" },
      { status: "error", value: "1 checks" },
    ]);
    expect(component.uptime).toBe(`${floorPct(857 / 864)}%`);
  });

  test("private-only monitor stays on per-region counts and is never asked for runs", async () => {
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.private, day, { ok: 5, error: 1 })],
    }));
    const { slug, componentId } = await pageWith(ids.private);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);

    expect(bar?.card).toEqual([
      { status: "success", value: "5 reqs" },
      { status: "error", value: "1 reqs" },
    ]);
    expect(pipes.calls.some((c) => c.name === "httpQuorum45d")).toBe(false);
  });

  test("a failed histogram converts per-region counts to runs and the page still renders", async () => {
    const day = yesterdayIn("UTC");
    pipes.impl.set("httpStatus45d", async () => ({
      data: [counts(ids.cloud, day, { ok: 720, error: 144 })],
    }));
    pipes.impl.set("httpQuorum45d", async () => {
      throw new Error("tinybird 500");
    });
    const { slug, componentId } = await pageWith(ids.cloud);

    const component = await uptime(slug, componentId);
    const bar = component.data.find((d) => d.day === day);

    expect(bar?.bar).toEqual([{ status: "error", height: 100 }]);
    expect(bar?.card).toEqual([
      { status: "success", value: "120 checks" },
      { status: "error", value: "24 checks" },
    ]);
    expect(component.uptime).toBe(`${floorPct(720 / 864)}%`);
  });
});

describe("getMonitor counts uptime in runs for monitors with a quorum population", () => {
  const publicIds = {} as Record<"cloud" | "private", number>;
  const bucketA = new Date("2026-11-08T08:00:00.000Z");
  const bucketB = new Date("2026-11-08T12:00:00.000Z");

  function uptimeRow(interval: Date, c: { success: number; error: number }) {
    return { interval, degraded: 0, ...c };
  }

  function intervalHist(
    interval: Date,
    b: { errorRegions: number; notOkRegions: number; runs: number },
  ) {
    return { interval, private: false, ...b };
  }

  async function monitorPage(monitorId: number) {
    const { slug } = await pageWith(monitorId);
    const result = await caller().statusPage.getMonitor({
      slug,
      id: monitorId,
    });
    if (!result) throw new Error("monitor missing");
    return result;
  }

  // what the monitor page and its markdown twin show
  function shown(
    rows: Parameters<typeof tallyBuckets>[0],
    regionCount: number | null,
  ) {
    const t = tallyBuckets(rows, regionCount);
    return {
      checks: roundCount(t.total),
      unit: regionCount !== null ? "checks" : "requests",
      uptime: t.total > 0 ? floorPct(t.up / t.total) : null,
    };
  }

  function view(result: Awaited<ReturnType<typeof monitorPage>>) {
    return shown(
      asCounts(result.data.uptime.data),
      result.data.uptime.regionCount,
    );
  }

  function asCounts(
    data: {
      success: number;
      degraded: number;
      error: number;
      quorum?: Parameters<typeof tallyBuckets>[0][number]["quorum"];
    }[],
  ) {
    return data.map((d) => ({
      ok: d.success,
      degraded: d.degraded,
      error: d.error,
      quorum: d.quorum,
    }));
  }

  beforeAll(async () => {
    publicIds.cloud = (
      await createMonitor(workspaceId, {
        active: true,
        public: true,
        jobType: "http",
        regions: SIX_REGIONS,
      })
    ).id;
    publicIds.private = (
      await createMonitor(workspaceId, {
        active: true,
        public: true,
        jobType: "http",
        regions: "",
      })
    ).id;
    await db.insert(privateLocationToMonitors).values({
      privateLocationId: locationId,
      monitorId: publicIds.private,
    });
  });

  test("1 of 6 regions failing every run: 100% and checks counted in runs", async () => {
    pipes.impl.set("httpUptimeWeekly", async () => ({
      data: [
        uptimeRow(bucketA, { success: 240, error: 48 }),
        uptimeRow(bucketB, { success: 240, error: 48 }),
      ],
    }));
    pipes.impl.set("httpQuorumIntervals", async () => ({
      data: [
        intervalHist(bucketA, { errorRegions: 1, notOkRegions: 1, runs: 48 }),
        intervalHist(bucketB, { errorRegions: 1, notOkRegions: 1, runs: 48 }),
      ],
    }));

    const result = await monitorPage(publicIds.cloud);

    expect(view(result)).toEqual({
      checks: 96,
      unit: "checks",
      uptime: 100,
    });
    const uptimeCall = pipes.calls.find((c) => c.name === "httpUptimeWeekly");
    const quorumCall = pipes.calls.find(
      (c) => c.name === "httpQuorumIntervals",
    );
    expect(quorumCall?.params).toEqual({
      monitorId: String(publicIds.cloud),
      interval: uptimeCall?.params.interval,
      fromDate: uptimeCall?.params.fromDate,
      toDate: uptimeCall?.params.toDate,
    });
  });

  test("3 of 6 failing in some runs: the % matches the run counts", async () => {
    pipes.impl.set("httpUptimeWeekly", async () => ({
      data: [
        uptimeRow(bucketA, { success: 276, error: 12 }),
        uptimeRow(bucketB, { success: 288, error: 0 }),
      ],
    }));
    pipes.impl.set("httpQuorumIntervals", async () => ({
      data: [
        intervalHist(bucketA, { errorRegions: 0, notOkRegions: 0, runs: 44 }),
        intervalHist(bucketA, { errorRegions: 3, notOkRegions: 3, runs: 4 }),
        intervalHist(bucketB, { errorRegions: 0, notOkRegions: 0, runs: 48 }),
      ],
    }));

    const result = await monitorPage(publicIds.cloud);
    const shownView = view(result);

    expect(shownView).toEqual({
      checks: 96,
      unit: "checks",
      uptime: floorPct(92 / 96),
    });
    expect(shownView.uptime).toBe(95.833);
  });

  test("private-only monitor stays on per-region counts and is never asked for runs", async () => {
    pipes.impl.set("httpUptimeWeekly", async () => ({
      data: [uptimeRow(bucketA, { success: 5, error: 1 })],
    }));

    const result = await monitorPage(publicIds.private);

    expect(result.data.uptime.regionCount).toBe(null);
    expect(view(result)).toEqual({
      checks: 6,
      unit: "requests",
      uptime: floorPct(5 / 6),
    });
    expect(pipes.calls.some((c) => c.name === "httpQuorumIntervals")).toBe(
      false,
    );
  });

  test("a failed histogram converts per-region counts to runs and the page still renders", async () => {
    pipes.impl.set("httpUptimeWeekly", async () => ({
      data: [uptimeRow(bucketA, { success: 240, error: 48 })],
    }));
    pipes.impl.set("httpQuorumIntervals", async () => {
      throw new Error("tinybird 500");
    });

    const result = await monitorPage(publicIds.cloud);

    expect(result.data.uptime.data).toEqual([
      uptimeRow(bucketA, { success: 240, error: 48 }),
    ]);
    expect(view(result)).toEqual({
      checks: 48,
      unit: "checks",
      uptime: floorPct(240 / 288),
    });
  });

  test("a bucket the histogram misses (the DNS case) is converted, not mixed in", async () => {
    const dnsId = (
      await createMonitor(workspaceId, {
        active: true,
        public: true,
        jobType: "dns",
        regions: SIX_REGIONS,
      })
    ).id;
    pipes.impl.set("dnsUptime30d", async () => ({
      data: [
        uptimeRow(bucketA, { success: 276, error: 12 }),
        uptimeRow(bucketB, { success: 282, error: 6 }),
      ],
    }));
    pipes.impl.set("dnsQuorumIntervals", async () => ({
      data: [
        intervalHist(bucketA, { errorRegions: 0, notOkRegions: 0, runs: 44 }),
        intervalHist(bucketA, { errorRegions: 3, notOkRegions: 3, runs: 4 }),
      ],
    }));

    const result = await monitorPage(dnsId);

    expect(view(result)).toEqual({
      checks: 96,
      unit: "checks",
      uptime: floorPct((44 + 47) / 96),
    });
  });
});
