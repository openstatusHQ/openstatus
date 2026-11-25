import { db, eq } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { NextRequest } from "next/server.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { appRouter } from "../root";
import { tb } from "../tb";
import { createInnerTRPCContext } from "../trpc";

type Row = {
  day: string;
  monitorId: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
};
type Pipe = (params: {
  monitorIds: string[];
  timezone?: string;
}) => Promise<{ data: Row[] }>;

function caller() {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal"),
      session: null,
    }),
  );
}

// yesterday in `timeZone`, keyed as UTC midnight like the pipes return it
function yesterdayIn(timeZone: string) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    Date.now() - 24 * 60 * 60 * 1000,
  );
  return `${date}T00:00:00.000Z`;
}

function rowsFor(monitorIds: string[], day: string, ok: number, error = 0) {
  return monitorIds.map((monitorId) => ({
    day,
    monitorId,
    count: ok + error,
    ok,
    degraded: 0,
    error,
  }));
}

function stub(getter: keyof typeof tb, impl: Pipe) {
  const fn = vi.fn(impl);
  // safe because every stubbed getter returns a pipe with this call shape
  vi.spyOn(tb, getter, "get").mockReturnValue(fn as never);
  return fn;
}

let workspaceId: number;
let cloudComponentId: number;
let privateComponentId: number;
let heartbeatComponentId: number;
let cloudMonitorId: string;

async function pageWith(defaultTimezone: string) {
  const created = await createPage(workspaceId, {
    configuration: { value: "runs", type: "absolute" },
    defaultTimezone,
  });
  return created;
}

describe("statusPage.getUptime in runs mode", () => {
  let utcSlug: string;
  let berlinSlug: string;
  const ids = () =>
    [cloudComponentId, privateComponentId, heartbeatComponentId].map(String);

  beforeAll(async () => {
    const fixture = await createTestWorkspace();
    workspaceId = fixture.workspace.id;
    const cloud = await createMonitor(workspaceId, {
      active: true,
      jobType: "http",
      regions: "ams,fra,iad,syd,gru,hkg",
    });
    const privateOnly = await createMonitor(workspaceId, {
      active: true,
      jobType: "http",
      regions: "",
    });
    const heartbeat = await createMonitor(workspaceId, {
      active: true,
      jobType: "heartbeat",
      regions: "",
    });
    cloudMonitorId = String(cloud.id);

    const utc = await pageWith("UTC");
    const berlin = await pageWith("Europe/Berlin");
    utcSlug = utc.slug;
    berlinSlug = berlin.slug;

    for (const p of [utc, berlin]) {
      const [c, pr, hb] = await Promise.all(
        [cloud, privateOnly, heartbeat].map((m, order) =>
          createPageComponent(workspaceId, p.id, {
            type: "monitor",
            monitorId: m.id,
            order,
          }),
        ),
      );
      if (p.id === utc.id) {
        cloudComponentId = c.id;
        privateComponentId = pr.id;
        heartbeatComponentId = hb.id;
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.workspaceId, workspaceId));
    await db.delete(page).where(eq(page.workspaceId, workspaceId));
  });

  test("counts runs for cloud monitors and requests for the rest", async () => {
    const day = yesterdayIn("UTC");
    const runs = stub("httpRuns45d", async ({ monitorIds }) => ({
      data: rowsFor(monitorIds, day, 140),
    }));
    const status = stub("httpStatus45d", async ({ monitorIds }) => ({
      data: rowsFor(monitorIds, day, 900, 100),
    }));
    const heartbeat = stub("heartbeatStatus45d", async ({ monitorIds }) => ({
      data: rowsFor(monitorIds, day, 50),
    }));

    const result = await caller().statusPage.getUptime({
      slug: utcSlug,
      pageComponentIds: ids(),
      cardType: "runs",
      barType: "absolute",
    });

    expect(runs).toHaveBeenCalledWith({ monitorIds: [cloudMonitorId] });
    expect(status.mock.calls.flatMap(([p]) => p.monitorIds)).not.toContain(
      cloudMonitorId,
    );
    expect(heartbeat).toHaveBeenCalled();

    const cardOn = (componentId: number) =>
      result
        ?.find((c) => c.id === componentId)
        ?.data.find((d) => d.day === day)
        ?.card.map((c) => c.value);
    expect(cardOn(cloudComponentId)).toEqual(["140 runs"]);
    expect(cardOn(privateComponentId)).toEqual(
      expect.arrayContaining(["900 reqs", "100 reqs"]),
    );
    expect(cardOn(heartbeatComponentId)).toEqual(["50 reqs"]);
    expect(result?.find((c) => c.id === cloudComponentId)?.uptime).toBe("100%");
  });

  test("groups runs into the page's days outside UTC", async () => {
    const day = yesterdayIn("Europe/Berlin");
    const runs = stub("httpRuns45d", async ({ monitorIds }) => ({
      data: rowsFor(monitorIds, day, 96),
    }));
    stub("httpStatus15m", async () => ({ data: [] }));
    stub("heartbeatStatus15m", async () => ({ data: [] }));

    const berlin = await db.query.page.findFirst({
      where: { slug: berlinSlug },
      with: { pageComponents: true },
    });
    const result = await caller().statusPage.getUptime({
      slug: berlinSlug,
      pageComponentIds: (berlin?.pageComponents ?? []).map((c) => String(c.id)),
      cardType: "runs",
      barType: "absolute",
    });

    expect(runs).toHaveBeenCalledWith({
      monitorIds: [cloudMonitorId],
      timezone: "Europe/Berlin",
    });
    const cloud = result?.find((c) => c.monitor?.id === Number(cloudMonitorId));
    expect(cloud?.timeZone).toBe("Europe/Berlin");
    expect(cloud?.data.find((d) => d.day === day)?.card[0]?.value).toBe(
      "96 runs",
    );
  });

  test("falls back to UTC days when Tinybird rejects the zone", async () => {
    const runs = stub("httpRuns45d", async ({ monitorIds, timezone }) => {
      if (timezone) throw new Error("Unknown time zone Europe/Berlin");
      return { data: rowsFor(monitorIds, yesterdayIn("UTC"), 10) };
    });
    stub("httpStatus15m", async () => ({ data: [] }));
    stub("heartbeatStatus15m", async () => ({ data: [] }));
    stub("httpStatus45d", async () => ({ data: [] }));
    stub("heartbeatStatus45d", async () => ({ data: [] }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const berlin = await db.query.page.findFirst({
      where: { slug: berlinSlug },
      with: { pageComponents: true },
    });
    const result = await caller().statusPage.getUptime({
      slug: berlinSlug,
      pageComponentIds: (berlin?.pageComponents ?? []).map((c) => String(c.id)),
      cardType: "runs",
      barType: "absolute",
    });

    expect(runs).toHaveBeenLastCalledWith({ monitorIds: [cloudMonitorId] });
    expect(result?.every((c) => c.timeZone === "UTC")).toBe(true);
  });

  test("requests mode never reads the runs pipes", async () => {
    const runs = stub("httpRuns45d", async () => ({ data: [] }));
    stub("httpStatus45d", async () => ({ data: [] }));
    stub("heartbeatStatus45d", async () => ({ data: [] }));

    await caller().statusPage.getUptime({
      slug: utcSlug,
      pageComponentIds: ids(),
      cardType: "requests",
      barType: "absolute",
    });

    expect(runs).not.toHaveBeenCalled();
  });
});
