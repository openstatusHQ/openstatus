import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { listUptimeTargetMaintenances } from "../maintenances";

const now = new Date(Date.UTC(2026, 10, 15, 12));

let ctx: ServiceContext;
let freeCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  const other = await createWorkspaceFixture("team");
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
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
      name: "svc-uptime-target-maintenance",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

async function insertPolicy(tx: Tx, monitorIds: number[]) {
  const policy = await tx
    .insert(uptimeTarget)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_500,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(uptimeTargetToMonitor).values(
      monitorIds.map((monitorId) => ({
        uptimeTargetId: policy.id,
        monitorId,
      })),
    );
  }
  return policy;
}

/** A status page with one component per monitor; returns the component ids by monitor. */
async function insertPage(
  tx: Tx,
  title: string,
  monitorIds: number[],
  workspaceId = ctx.workspace.id,
) {
  const p = await tx
    .insert(page)
    .values({
      workspaceId,
      title,
      description: "",
      slug: `svc-uptime-target-mw-${crypto.randomUUID().slice(0, 8)}`,
      customDomain: "",
    })
    .returning()
    .get();
  const components = new Map<number, number>();
  for (const monitorId of monitorIds) {
    const c = await tx
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId: p.id,
        type: "monitor",
        monitorId,
        name: `component ${monitorId}`,
      })
      .returning()
      .get();
    components.set(monitorId, c.id);
  }
  return { page: p, components };
}

async function insertMaintenance(
  tx: Tx,
  args: {
    pageId: number;
    title: string;
    from: Date;
    to: Date;
    componentIds: number[];
    workspaceId?: number;
    monitorMaintenanceWindowId?: number;
  },
) {
  const m = await tx
    .insert(maintenance)
    .values({
      workspaceId: args.workspaceId ?? ctx.workspace.id,
      pageId: args.pageId,
      title: args.title,
      message: "",
      from: args.from,
      to: args.to,
      monitorMaintenanceWindowId: args.monitorMaintenanceWindowId,
    })
    .returning()
    .get();
  if (args.componentIds.length > 0) {
    await tx.insert(maintenancesToPageComponents).values(
      args.componentIds.map((pageComponentId) => ({
        maintenanceId: m.id,
        pageComponentId,
      })),
    );
  }
  return m;
}

async function insertWindow(
  tx: Tx,
  args: {
    title: string;
    mode: "pause" | "continue";
    from: Date;
    to: Date;
    monitorIds: number[];
  },
) {
  const w = await tx
    .insert(monitorMaintenanceWindow)
    .values({
      workspaceId: ctx.workspace.id,
      title: args.title,
      mode: args.mode,
      from: args.from,
      to: args.to,
    })
    .returning()
    .get();
  await tx.insert(monitorMaintenanceWindowToMonitor).values(
    args.monitorIds.map((monitorId) => ({
      monitorMaintenanceWindowId: w.id,
      monitorId,
    })),
  );
  return w;
}

const utc = (y: number, m: number, d: number, h = 0) =>
  new Date(Date.UTC(y, m - 1, d, h));

describe("listUptimeTargetMaintenances", () => {
  test("finds windows through the monitors' status page components, once per window", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const web = await insertMonitor(tx, { name: "Web" });
      const outside = await insertMonitor(tx, { name: "Not in policy" });
      const policy = await insertPolicy(tx, [api.id, web.id]);
      const main = await insertPage(tx, "Main", [api.id, web.id, outside.id]);
      const partner = await insertPage(tx, "Partner", [api.id]);

      // touches both policy monitors: listed once, with both
      const both = await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Database upgrade",
        from: utc(2026, 10, 3, 2),
        to: utc(2026, 10, 3, 4),
        componentIds: [
          main.components.get(api.id) ?? 0,
          main.components.get(web.id) ?? 0,
        ],
      });
      // spans two months: listed once, under the month it started in
      const spanning = await insertMaintenance(tx, {
        pageId: partner.page.id,
        title: "Network move",
        from: utc(2026, 9, 30, 22),
        to: utc(2026, 10, 1, 2),
        componentIds: [partner.components.get(api.id) ?? 0],
      });
      // only a monitor outside the policy
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Unrelated",
        from: utc(2026, 10, 5),
        to: utc(2026, 10, 5, 1),
        componentIds: [main.components.get(outside.id) ?? 0],
      });
      // still ahead of now
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Scheduled",
        from: utc(2026, 11, 20),
        to: utc(2026, 11, 20, 1),
        componentIds: [main.components.get(api.id) ?? 0],
      });
      // before the range
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Too old",
        from: utc(2025, 10, 1),
        to: utc(2025, 10, 1, 1),
        componentIds: [main.components.get(api.id) ?? 0],
      });

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });

      expect(res.months).toHaveLength(13);
      expect(res.months.at(-1)).toBe("2026-11-01");
      expect(res.windows.map((w) => w.title)).toEqual([
        "Database upgrade",
        "Network move",
      ]);
      expect(res.windows[0]).toMatchObject({
        kind: "page",
        mode: "pause",
        id: both.id,
        pageId: main.page.id,
        pageTitle: "Main",
        monitorIds: [api.id, web.id],
        month: "2026-10-01",
        excusable: true,
      });
      expect(res.windows[1]).toMatchObject({
        id: spanning.id,
        pageTitle: "Partner",
        monitorIds: [api.id],
        month: "2026-09-01",
        // September is older than the previous month: no window fits it
        excusable: false,
      });

      expect(res.monitors).toEqual([
        { id: api.id, name: "API" },
        { id: web.id, name: "Web" },
      ]);
    });
  });

  test("a monitor without maintenances lists no windows", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(res.windows).toEqual([]);
      expect(res.monitors).toEqual([{ id: api.id, name: "API" }]);
    });
  });

  test("lists maintenance windows with their own mode, without a status page", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const web = await insertMonitor(tx, { name: "Web" });
      const policy = await insertPolicy(tx, [api.id, web.id]);
      const main = await insertPage(tx, "Main", [api.id]);
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Page maintenance",
        from: utc(2026, 11, 2),
        to: utc(2026, 11, 2, 1),
        componentIds: [main.components.get(api.id) ?? 0],
      });
      const window = await insertWindow(tx, {
        title: "Contract migration",
        mode: "continue",
        from: utc(2026, 11, 4),
        to: utc(2026, 11, 4, 2),
        monitorIds: [api.id, web.id],
      });

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });

      expect(
        res.windows.map((w) => [w.kind, w.title, w.mode, w.monitorIds]),
      ).toEqual([
        ["window", "Contract migration", "continue", [api.id, web.id]],
        ["page", "Page maintenance", "pause", [api.id]],
      ]);
      expect(res.windows[0]).toMatchObject({
        id: window.id,
        pageId: null,
        pageTitle: null,
        month: "2026-11-01",
        excusable: true,
      });
    });
  });

  test("a maintenance announcing a window is listed with that window", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);
      const main = await insertPage(tx, "Main", [api.id]);
      const window = await insertWindow(tx, {
        title: "Contract migration",
        mode: "continue",
        from: utc(2026, 11, 2),
        to: utc(2026, 11, 2, 1),
        monitorIds: [api.id],
      });
      const announcement = await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Contract migration",
        from: utc(2026, 11, 2),
        to: utc(2026, 11, 2, 1),
        componentIds: [main.components.get(api.id) ?? 0],
        monitorMaintenanceWindowId: window.id,
      });

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });

      expect(res.windows).toHaveLength(1);
      expect(res.windows[0]).toMatchObject({
        kind: "window",
        id: window.id,
        mode: "continue",
        announcements: [
          { id: announcement.id, pageId: main.page.id, pageTitle: "Main" },
        ],
      });
    });
  });

  test("a window that started before the range is listed under its first month", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const main = await insertPage(tx, "Main", [api.id]);
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Overnight",
        from: utc(2025, 10, 31, 22),
        to: utc(2025, 11, 1, 2),
        componentIds: [main.components.get(api.id) ?? 0],
      });

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(res.months[0]).toBe("2025-11-01");
      expect(res.windows.map((w) => [w.title, w.month])).toEqual([
        ["Overnight", "2025-11-01"],
      ]);
    });
  });

  test("24 months reaches further back", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const main = await insertPage(tx, "Main", [api.id]);
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Last year",
        from: utc(2025, 3, 1),
        to: utc(2025, 3, 1, 1),
        componentIds: [main.components.get(api.id) ?? 0],
      });

      const twelve = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(twelve.windows).toEqual([]);
      const wide = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, months: 24 },
        now,
      });
      expect(wide.windows.map((w) => w.title)).toEqual(["Last year"]);
    });
  });

  test("a deleted monitor is left out", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { deletedAt: utc(2026, 11, 1) });
      const policy = await insertPolicy(tx, [api.id]);
      const main = await insertPage(tx, "Main", [api.id]);
      await insertMaintenance(tx, {
        pageId: main.page.id,
        title: "Gone",
        from: utc(2026, 10, 1),
        to: utc(2026, 10, 1, 1),
        componentIds: [main.components.get(api.id) ?? 0],
      });

      const res = await listUptimeTargetMaintenances({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(res.monitors).toEqual([]);
      expect(res.windows).toEqual([]);
    });
  });

  test("another workspace's policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, []);
      await expect(
        listUptimeTargetMaintenances({
          ctx: { ...otherCtx, db: tx },
          input: { id: policy.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("needs the uptime-target limit", async () => {
    await expect(
      listUptimeTargetMaintenances({ ctx: freeCtx, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("a key needs monitors:read", async () => {
    const key = makeApiKeyCtx(ctx.workspace, {
      keyId: "k",
      scopes: ["incidents:read"],
    });
    await expect(
      listUptimeTargetMaintenances({ ctx: key, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
