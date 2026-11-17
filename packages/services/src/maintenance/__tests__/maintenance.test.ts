import { db, eq, inArray } from "@openstatus/db";
import {
  maintenanceUpdate,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  selectMaintenancePageSchema,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  expectAuditRow,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSlackCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from "../../errors";
import { createMaintenanceWindow } from "../../maintenance-window/create";
import { deleteMaintenanceWindow } from "../../maintenance-window/delete";
import { monitorIdsOf } from "../../maintenance-window/internal";
import {
  getMaintenanceWindow,
  listMaintenanceWindows,
} from "../../maintenance-window/list";
import {
  endMaintenanceWindow,
  updateMaintenanceWindow,
} from "../../maintenance-window/update";
import { deleteMonitor } from "../../monitor/delete";
import { deletePageComponent } from "../../page-component/delete";
import { deletePage } from "../../page/delete";
import { getStatusPageContent } from "../../page/get-content";
import { addMaintenanceUpdate } from "../add-update";
import { createMaintenance } from "../create";
import { deleteMaintenance } from "../delete";
import { deleteMaintenanceUpdate } from "../delete-update";
import { linkMaintenanceWindow, unlinkMaintenanceWindow } from "../link-window";
import { getMaintenance, listMaintenances } from "../list";
import { notifyMaintenance } from "../notify";
import { updateMaintenance } from "../update";
import { updateMaintenanceUpdate } from "../update-update";

const subscriptionSpies = (globalThis as Record<string, unknown>)
  .__subscriptionSpies as
  | {
      dispatchMaintenanceUpdate: {
        mockClear: () => void;
        mock: { calls: unknown[][] };
      };
    }
  | undefined;

const TEST_PREFIX = "svc-maintenance-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testPageId: number;
let testPageComponentId: number;
// Second page + component on the same workspace, used to exercise the
// "all components must share a page" ConflictError branch.
let otherPageId: number;
let otherPageComponentId: number;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  const pageRow = await db
    .insert(page)
    .values({
      workspaceId: team.id,
      title: `${TEST_PREFIX}-page`,
      description: "test page",
      slug: `${TEST_PREFIX}-page-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = pageRow.id;

  const componentRow = await db
    .insert(pageComponent)
    .values({
      workspaceId: team.id,
      pageId: testPageId,
      name: `${TEST_PREFIX}-component`,
      type: "static",
    })
    .returning()
    .get();
  testPageComponentId = componentRow.id;

  const otherPageRow = await db
    .insert(page)
    .values({
      workspaceId: team.id,
      title: `${TEST_PREFIX}-other-page`,
      description: "other test page",
      slug: `${TEST_PREFIX}-other-page-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  otherPageId = otherPageRow.id;

  const otherComponentRow = await db
    .insert(pageComponent)
    .values({
      workspaceId: team.id,
      pageId: otherPageId,
      name: `${TEST_PREFIX}-other-component`,
      type: "static",
    })
    .returning()
    .get();
  otherPageComponentId = otherComponentRow.id;
});

afterAll(async () => {
  await db
    .delete(pageComponent)
    .where(
      inArray(pageComponent.id, [testPageComponentId, otherPageComponentId]),
    )
    .catch(() => undefined);
  await db
    .delete(page)
    .where(inArray(page.id, [testPageId, otherPageId]))
    .catch(() => undefined);
});

beforeEach(() => {
  subscriptionSpies?.dispatchMaintenanceUpdate.mockClear();
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitorIn(tx: Tx, name: string) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: teamCtx.workspace.id,
      name: `${TEST_PREFIX}-${name}`,
      url: "https://example.com",
      regions: "ams",
      active: true,
    })
    .returning()
    .get();
}

async function insertMonitorComponentIn(tx: Tx, name: string, pageId: number) {
  const m = await insertMonitorIn(tx, name);
  const component = await tx
    .insert(pageComponent)
    .values({
      workspaceId: teamCtx.workspace.id,
      pageId,
      name: `${TEST_PREFIX}-${name}-component`,
      type: "monitor",
      monitorId: m.id,
    })
    .returning()
    .get();
  return { monitor: m, component };
}

function derivedWindowOf(tx: Tx, maintenanceId: number) {
  return tx
    .select()
    .from(monitorMaintenanceWindow)
    .where(eq(monitorMaintenanceWindow.maintenanceId, maintenanceId))
    .get();
}

function futureRange(startIn = 60 * 60 * 1000) {
  // whole seconds, the precision the columns keep
  const now = Math.floor(Date.now() / 1000) * 1000;
  return {
    from: new Date(now + startIn),
    to: new Date(now + startIn + 30 * 60 * 1000),
  };
}

describe("createMaintenance", () => {
  test("creates + associations + audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const range = futureRange();
      const { maintenance: record, initialUpdate } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-happy`,
          message: "planned work",
          ...range,
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      expect(record.title).toBe(`${TEST_PREFIX}-happy`);
      expect(record.pageId).toBe(testPageId);
      expect(initialUpdate.maintenanceId).toBe(record.id);
      expect(initialUpdate.message).toBe("planned work");
      expect(initialUpdate.createdBy).toBe(1);

      const assoc = await tx
        .select()
        .from(maintenancesToPageComponents)
        .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
        .all();
      expect(assoc.map((a) => a.pageComponentId)).toEqual([
        testPageComponentId,
      ]);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "maintenance.create",
        entityType: "maintenance",
        entityId: record.id,
        db: tx,
      });
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "maintenance_update.create",
        entityType: "maintenance_update",
        entityId: initialUpdate.id,
        db: tx,
      });
    });
  });

  test("throws when page is in another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const range = futureRange();
      await expect(
        createMaintenance({
          ctx: { ...freeCtx, db: tx },
          input: {
            title: `${TEST_PREFIX}-cross-ws`,
            message: "m",
            ...range,
            pageId: testPageId,
            pageComponentIds: [],
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws ZodError when from >= to", async () => {
    await withTestTransaction(async (tx) => {
      const now = new Date();
      await expect(
        createMaintenance({
          ctx: { ...teamCtx, db: tx },
          input: {
            title: `${TEST_PREFIX}-range`,
            message: "m",
            from: now,
            to: now,
            pageId: testPageId,
            pageComponentIds: [],
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("deduplicates pageComponentIds", async () => {
    await withTestTransaction(async (tx) => {
      // Duplicate ids in the input would violate the composite PK on
      // `maintenances_to_page_components` if not deduped. Guard against a
      // regression where the `Set` in `validatePageComponentIds` is dropped.
      const { maintenance: record } = await createMaintenance({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-dedupe`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId, testPageComponentId],
        },
      });

      const assoc = await tx
        .select()
        .from(maintenancesToPageComponents)
        .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
        .all();
      expect(assoc).toHaveLength(1);
      expect(assoc[0].pageComponentId).toBe(testPageComponentId);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createMaintenance({
          ctx: readOnlyCtx,
          input: {
            title: `${TEST_PREFIX}-read-only`,
            message: "m",
            ...futureRange(),
            pageId: testPageId,
            pageComponentIds: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("throws ConflictError when components span multiple pages", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createMaintenance({
          ctx: { ...teamCtx, db: tx },
          input: {
            title: `${TEST_PREFIX}-mixed-pages`,
            message: "m",
            ...futureRange(),
            pageId: testPageId,
            pageComponentIds: [testPageComponentId, otherPageComponentId],
          },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});

describe("updateMaintenance", () => {
  test("updates title + replaces associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-update`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const updated = await updateMaintenance({
        ctx,
        input: {
          id: record.id,
          title: `${TEST_PREFIX}-update-renamed`,
          pageComponentIds: [],
        },
      });
      expect(updated.title).toBe(`${TEST_PREFIX}-update-renamed`);

      const assoc = await tx
        .select()
        .from(maintenancesToPageComponents)
        .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
        .all();
      expect(assoc).toHaveLength(0);
    });
  });

  test("message rewrites the newest update and audits it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record, initialUpdate } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-update-message`,
          message: "first",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      const later = await addMaintenanceUpdate({
        ctx,
        input: {
          maintenanceId: record.id,
          message: "second",
          date: new Date(Date.now() + 1000),
        },
      });

      await updateMaintenance({
        ctx,
        input: { id: record.id, message: "second, edited" },
      });

      const full = await getMaintenance({ ctx, input: { id: record.id } });
      expect(full.message).toBe("second, edited");
      expect(full.updates.map((u) => [u.id, u.message])).toEqual([
        [later.id, "second, edited"],
        [initialUpdate.id, "first"],
      ]);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "maintenance_update.update",
        entityType: "maintenance_update",
        entityId: later.id,
        db: tx,
      });
    });
  });

  test("keeps pageId when clearing all components", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-keep-page`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const updated = await updateMaintenance({
        ctx,
        input: { id: record.id, pageComponentIds: [] },
      });
      expect(updated.pageId).toBe(testPageId);

      const assoc = await tx
        .select()
        .from(maintenancesToPageComponents)
        .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
        .all();
      expect(assoc).toHaveLength(0);
    });
  });

  test("moves pageId when components belong to another page", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-move-page`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const updated = await updateMaintenance({
        ctx,
        input: { id: record.id, pageComponentIds: [otherPageComponentId] },
      });
      expect(updated.pageId).toBe(otherPageId);
    });
  });

  test("throws NotFoundError for cross-workspace update", async () => {
    await withTestTransaction(async (tx) => {
      const { maintenance: record } = await createMaintenance({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-cross-ws-update`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        updateMaintenance({
          ctx: { ...freeCtx, db: tx },
          input: { id: record.id, title: "blocked" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects partial update that crosses the from/to invariant", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      // The Zod refine on CreateMaintenanceInput only catches simultaneous
      // `{from, to}` submissions. A partial update that moves only `to`
      // earlier than the stored `from` has to be rejected by the service's
      // own effective-range check. Regression guard for that code path.
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-range-update`,
          message: "m",
          ...futureRange(60 * 60 * 1000),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        updateMaintenance({
          ctx,
          input: { id: record.id, to: new Date(Date.now() - 60 * 60 * 1000) },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("throws ConflictError when pageComponentIds span multiple pages", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-update-mixed-pages`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await expect(
        updateMaintenance({
          ctx,
          input: {
            id: record.id,
            pageComponentIds: [testPageComponentId, otherPageComponentId],
          },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});

describe("deleteMaintenance", () => {
  test("cascades associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-delete`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await deleteMaintenance({ ctx, input: { id: record.id } });

      const remainingAssoc = await tx
        .select()
        .from(maintenancesToPageComponents)
        .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
        .all();
      expect(remainingAssoc).toHaveLength(0);
    });
  });
});

describe("list / get", () => {
  test("respects workspace isolation", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx: teamCtxTx,
        input: {
          title: `${TEST_PREFIX}-isolation`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        getMaintenance({ ctx: freeCtxTx, input: { id: record.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const { items } = await listMaintenances({
        ctx: freeCtxTx,
        input: {
          limit: 100,
          offset: 0,
          pageId: testPageId,
          order: "desc",
        },
      });
      expect(items.find((m) => m.id === record.id)).toBeUndefined();
    });
  });

  test("list returns totalSize and enriched relations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-list-enrich`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const full = await getMaintenance({
        ctx,
        input: { id: record.id },
      });
      expect(full.pageComponents.map((c) => c.id)).toEqual([
        testPageComponentId,
      ]);
      expect(full.pageComponentIds).toEqual([testPageComponentId]);
    });
  });

  test("the window link stays out of public status-page content", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-public`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      const content = await getStatusPageContent({ ctx, pageId: testPageId });
      const shown = content.maintenances.find((m) => m.id === record.id);
      expect(shown).toBeDefined();
      expect(shown).not.toHaveProperty("monitorMaintenanceWindowId");
      expect(selectMaintenancePageSchema.parse(record)).not.toHaveProperty(
        "monitorMaintenanceWindowId",
      );
    });
  });

  test("lists the monitors behind its components and filters by monitor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await tx
        .insert(monitor)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-api`,
          url: "https://example.com",
          regions: "ams",
          active: true,
        })
        .returning()
        .get();
      const component = await tx
        .insert(pageComponent)
        .values({
          workspaceId: teamCtx.workspace.id,
          pageId: testPageId,
          name: `${TEST_PREFIX}-api-component`,
          type: "monitor",
          monitorId: api.id,
        })
        .returning()
        .get();
      const { maintenance: withMonitor } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-affected`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [component.id, testPageComponentId],
        },
      });
      const { maintenance: staticOnly } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-static-only`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const full = await getMaintenance({ ctx, input: { id: withMonitor.id } });
      expect(full.affectedMonitors).toEqual([
        { id: api.id, name: `${TEST_PREFIX}-api` },
      ]);
      const none = await getMaintenance({ ctx, input: { id: staticOnly.id } });
      expect(none.affectedMonitors).toEqual([]);

      const { items } = await listMaintenances({
        ctx,
        input: { limit: 100, offset: 0, monitorId: api.id, order: "desc" },
      });
      expect(items.map((m) => m.id)).toEqual([withMonitor.id]);
    });
  });

  test("filters by monitor through the announced window, without a component", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorIn(tx, "window-filter-api");
      const other = await insertMonitorIn(tx, "window-filter-other");
      const window = await createMaintenanceWindow({
        ctx,
        input: {
          title: `${TEST_PREFIX}-filter-window`,
          ...futureRange(),
          monitorIds: [api.id],
        },
      });
      const { maintenance: linked } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-filter-announce`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
          monitorMaintenanceWindowId: window.id,
        },
      });

      const covered = await listMaintenances({
        ctx,
        input: { limit: 100, offset: 0, monitorId: api.id, order: "desc" },
      });
      expect(covered.items.map((m) => m.id)).toEqual([linked.id]);
      expect(covered.totalSize).toBe(1);
      const uncovered = await listMaintenances({
        ctx,
        input: { limit: 100, offset: 0, monitorId: other.id, order: "desc" },
      });
      expect(uncovered.items).toEqual([]);
    });
  });
});

describe("derived window", () => {
  test("a maintenance with a monitor-backed component gets a pause window with its times, title and monitors", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorComponentIn(tx, "derived-api", testPageId);
      const range = futureRange();
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-derived`,
          message: "m",
          ...range,
          pageId: testPageId,
          pageComponentIds: [api.component.id, testPageComponentId],
        },
      });

      const derived = await derivedWindowOf(tx, record.id);
      expect(derived).toMatchObject({
        title: `${TEST_PREFIX}-derived`,
        mode: "pause",
        from: record.from,
        to: record.to,
        workspaceId: teamCtx.workspace.id,
      });
      expect(record.monitorMaintenanceWindowId).toBe(derived?.id);
      expect(await monitorIdsOf(tx, derived?.id ?? 0)).toEqual([
        api.monitor.id,
      ]);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_maintenance_window.create",
        entityType: "monitor_maintenance_window",
        entityId: derived?.id ?? 0,
        db: tx,
      });

      const full = await getMaintenance({ ctx, input: { id: record.id } });
      expect(full.window).toMatchObject({ id: derived?.id, derived: true });
      expect(full.affectedMonitors.map((m) => m.id)).toEqual([api.monitor.id]);

      const listed = await listMaintenanceWindows({ ctx });
      expect(listed.find((w) => w.id === derived?.id)).toMatchObject({
        derivedFrom: {
          maintenanceId: record.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-derived`,
        },
        announcements: [],
      });
    });
  });

  test("no monitor-backed component, no window", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-static`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });
      expect(record.monitorMaintenanceWindowId).toBeNull();
      expect(await derivedWindowOf(tx, record.id)).toBeUndefined();
      const full = await getMaintenance({ ctx, input: { id: record.id } });
      expect(full.window).toBeNull();
      expect(full.affectedMonitors).toEqual([]);
    });
  });

  test("times, title and components of the maintenance move its window", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorComponentIn(tx, "sync-api", testPageId);
      const web = await insertMonitorComponentIn(tx, "sync-web", testPageId);
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-sync`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [api.component.id],
        },
      });
      const windowId = record.monitorMaintenanceWindowId ?? 0;

      const later = futureRange(3 * 60 * 60 * 1000);
      await updateMaintenance({
        ctx,
        input: {
          id: record.id,
          title: `${TEST_PREFIX}-sync-renamed`,
          ...later,
          pageComponentIds: [api.component.id, web.component.id],
        },
      });
      const moved = await derivedWindowOf(tx, record.id);
      expect(moved).toMatchObject({
        id: windowId,
        title: `${TEST_PREFIX}-sync-renamed`,
        from: later.from,
        to: later.to,
      });
      expect(await monitorIdsOf(tx, windowId)).toEqual(
        [api.monitor.id, web.monitor.id].sort((a, b) => a - b),
      );
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_maintenance_window.update",
        entityType: "monitor_maintenance_window",
        entityId: windowId,
        db: tx,
      });

      const cleared = await updateMaintenance({
        ctx,
        input: { id: record.id, pageComponentIds: [testPageComponentId] },
      });
      expect(cleared.monitorMaintenanceWindowId).toBeNull();
      expect(await derivedWindowOf(tx, record.id)).toBeUndefined();
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_maintenance_window.delete",
        entityType: "monitor_maintenance_window",
        entityId: windowId,
        db: tx,
      });

      const back = await updateMaintenance({
        ctx,
        input: { id: record.id, pageComponentIds: [web.component.id] },
      });
      const again = await derivedWindowOf(tx, record.id);
      expect(back.monitorMaintenanceWindowId).toBe(again?.id);
      expect(await monitorIdsOf(tx, again?.id ?? 0)).toEqual([web.monitor.id]);
    });
  });

  test("deleting a component or a monitor shrinks the window, the last one removes it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorComponentIn(tx, "shrink-api", testPageId);
      const web = await insertMonitorComponentIn(tx, "shrink-web", testPageId);
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-shrink`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [api.component.id, web.component.id],
        },
      });
      const windowId = record.monitorMaintenanceWindowId ?? 0;

      await deletePageComponent({ ctx, input: { id: api.component.id } });
      expect(await monitorIdsOf(tx, windowId)).toEqual([web.monitor.id]);

      await deleteMonitor({ ctx, input: { id: web.monitor.id } });
      expect(await derivedWindowOf(tx, record.id)).toBeUndefined();
      const after = await getMaintenance({ ctx, input: { id: record.id } });
      expect(after.monitorMaintenanceWindowId).toBeNull();
      expect(after.window).toBeNull();
    });
  });

  test("deleting the maintenance or its page takes the window with it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorComponentIn(tx, "gone-api", testPageId);
      const { maintenance: first } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-gone`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [api.component.id],
        },
      });
      const firstWindowId = first.monitorMaintenanceWindowId ?? 0;
      await deleteMaintenance({ ctx, input: { id: first.id } });
      expect(await derivedWindowOf(tx, first.id)).toBeUndefined();
      expect(await monitorIdsOf(tx, firstWindowId)).toEqual([]);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_maintenance_window.delete",
        entityType: "monitor_maintenance_window",
        entityId: firstWindowId,
        db: tx,
      });

      const other = await insertMonitorComponentIn(
        tx,
        "gone-other",
        otherPageId,
      );
      const { maintenance: second } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-gone-page`,
          message: "m",
          ...futureRange(),
          pageId: otherPageId,
          pageComponentIds: [other.component.id],
        },
      });
      expect(await derivedWindowOf(tx, second.id)).toBeDefined();
      await deletePage({ ctx, input: { id: otherPageId } });
      expect(await derivedWindowOf(tx, second.id)).toBeUndefined();
    });
  });

  test("a derived window refuses edit, end, delete and announce", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorComponentIn(tx, "locked-api", testPageId);
      const now = Date.now();
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-managed`,
          message: "m",
          from: new Date(now - 60_000),
          to: new Date(now + 60 * 60 * 1000),
          pageId: testPageId,
          pageComponentIds: [api.component.id],
        },
      });
      const id = record.monitorMaintenanceWindowId ?? 0;

      await expect(
        updateMaintenanceWindow({ ctx, input: { id, title: "x" } }),
      ).rejects.toThrow(/managed by the status page maintenance .*-managed/);
      await expect(
        endMaintenanceWindow({ ctx, input: { id } }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(
        deleteMaintenanceWindow({ ctx, input: { id } }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(
        createMaintenance({
          ctx,
          input: {
            title: `${TEST_PREFIX}-announce-derived`,
            message: "m",
            ...futureRange(),
            pageId: testPageId,
            pageComponentIds: [],
            monitorMaintenanceWindowId: id,
          },
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      const { maintenance: other } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-link-derived`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      await expect(
        linkMaintenanceWindow({
          ctx,
          input: { id: other.id, monitorMaintenanceWindowId: id },
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      expect(await derivedWindowOf(tx, record.id)).toMatchObject({ id });
    });
  });
});

describe("announcing a user window", () => {
  test("no derived window, its own times, and the window's monitors are the affected ones", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorIn(tx, "linked-api");
      const shown = await insertMonitorComponentIn(tx, "shown", testPageId);
      const window = await createMaintenanceWindow({
        ctx,
        input: {
          title: `${TEST_PREFIX}-window`,
          mode: "continue",
          ...futureRange(),
          monitorIds: [api.id],
        },
      });
      const publicRange = futureRange(5 * 60 * 60 * 1000);
      const { maintenance: linked } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-announce`,
          message: "m",
          ...publicRange,
          pageId: testPageId,
          pageComponentIds: [shown.component.id],
          monitorMaintenanceWindowId: window.id,
        },
      });
      expect(linked.monitorMaintenanceWindowId).toBe(window.id);
      expect(linked.from).toEqual(publicRange.from);
      expect(linked.to).toEqual(publicRange.to);
      expect(await derivedWindowOf(tx, linked.id)).toBeUndefined();

      const full = await getMaintenance({ ctx, input: { id: linked.id } });
      expect(full.window).toEqual({
        id: window.id,
        title: `${TEST_PREFIX}-window`,
        mode: "continue",
        from: window.from,
        to: window.to,
        derived: false,
      });
      expect(full.affectedMonitors.map((m) => m.id)).toEqual([api.id]);

      const wider = new Date(publicRange.to.getTime() + 60_000);
      const edited = await updateMaintenance({
        ctx,
        input: { id: linked.id, to: wider },
      });
      expect(edited.to).toEqual(wider);
      expect(await derivedWindowOf(tx, linked.id)).toBeUndefined();

      const moved = new Date(window.to.getTime() + 30 * 60 * 1000);
      await updateMaintenanceWindow({
        ctx,
        input: { id: window.id, to: moved },
      });
      const after = await getMaintenance({ ctx, input: { id: linked.id } });
      expect(after.to).toEqual(wider);
      expect(after.window?.to).toEqual(moved);

      const listed = await getMaintenanceWindow({
        ctx,
        input: { id: window.id },
      });
      expect(listed.derivedFrom).toBeNull();
      expect(listed.announcements.map((a) => a.id)).toEqual([linked.id]);
    });
  });

  test("a window cannot be deleted while announced; unlinking frees it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const api = await insertMonitorIn(tx, "unlink-api");
      const window = await createMaintenanceWindow({
        ctx,
        input: {
          title: `${TEST_PREFIX}-window-delete`,
          ...futureRange(),
          monitorIds: [api.id],
        },
      });
      const { maintenance: linked } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-announce-delete`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
          monitorMaintenanceWindowId: window.id,
        },
      });

      await expect(
        deleteMaintenanceWindow({ ctx, input: { id: window.id } }),
      ).rejects.toThrow(/announce-delete/);

      const unlinked = await unlinkMaintenanceWindow({
        ctx,
        input: { id: linked.id },
      });
      expect(unlinked.monitorMaintenanceWindowId).toBeNull();
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "maintenance.update",
        entityType: "maintenance",
        entityId: linked.id,
        db: tx,
      });
      await deleteMaintenanceWindow({ ctx, input: { id: window.id } });
    });
  });

  test("link removes the derived window, unlink derives it again", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const shown = await insertMonitorComponentIn(tx, "relink", testPageId);
      const other = await insertMonitorIn(tx, "relink-other");
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-relink`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [shown.component.id],
        },
      });
      const derivedId = record.monitorMaintenanceWindowId ?? 0;
      expect(derivedId).toBeGreaterThan(0);
      // unlinking a derived window is a no-op: there is nothing announced
      const same = await unlinkMaintenanceWindow({
        ctx,
        input: { id: record.id },
      });
      expect(same.monitorMaintenanceWindowId).toBe(derivedId);

      const window = await createMaintenanceWindow({
        ctx,
        input: {
          title: `${TEST_PREFIX}-relink-window`,
          mode: "continue",
          ...futureRange(2 * 60 * 60 * 1000),
          monitorIds: [other.id],
        },
      });
      const linked = await linkMaintenanceWindow({
        ctx,
        input: { id: record.id, monitorMaintenanceWindowId: window.id },
      });
      expect(linked.monitorMaintenanceWindowId).toBe(window.id);
      expect(linked.from).toEqual(record.from);
      expect(await derivedWindowOf(tx, record.id)).toBeUndefined();
      expect(await monitorIdsOf(tx, derivedId)).toEqual([]);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_maintenance_window.delete",
        entityType: "monitor_maintenance_window",
        entityId: derivedId,
        db: tx,
      });

      const unlinked = await unlinkMaintenanceWindow({
        ctx,
        input: { id: record.id },
      });
      const again = await derivedWindowOf(tx, record.id);
      expect(again).toMatchObject({ mode: "pause", from: record.from });
      expect(unlinked.monitorMaintenanceWindowId).toBe(again?.id);
      expect(await monitorIdsOf(tx, again?.id ?? 0)).toEqual([
        shown.monitor.id,
      ]);
    });
  });

  test("link rejects a window of another workspace and a read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: record } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-link-foreign`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      await expect(
        linkMaintenanceWindow({
          ctx,
          input: { id: record.id, monitorMaintenanceWindowId: 999_999_999 },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        linkMaintenanceWindow({
          ctx: makeApiKeyCtx(teamCtx.workspace, {
            keyId: "ro",
            scopes: ["incidents:read"],
          }),
          input: { id: 1, monitorMaintenanceWindowId: 1 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("notifyMaintenance", () => {
  test("throws when the announcement belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const { initialUpdate } = await createMaintenance({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-notify-cross-ws`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        notifyMaintenance({
          ctx: { ...freeCtx, db: tx },
          input: { maintenanceUpdateId: initialUpdate.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("slack actor path", () => {
    test("createMaintenance succeeds with a slack actor", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = {
          ...makeSlackCtx(teamCtx.workspace, {
            teamId: "T123",
            slackUserId: "U123",
            userId: 1,
          }),
          db: tx,
        };
        const { maintenance: record } = await createMaintenance({
          ctx,
          input: {
            title: `${TEST_PREFIX}-slack`,
            message: "scheduled via slack",
            ...futureRange(),
            pageId: testPageId,
            pageComponentIds: [],
          },
        });
        await expectAuditRow({
          workspaceId: teamCtx.workspace.id,
          action: "maintenance.create",
          entityType: "maintenance",
          entityId: record.id,
          actorType: "slack",
          db: tx,
        });
      });
    });
  });

  describe("maintenance updates", () => {
    async function createParent(ctx: ServiceContext, suffix: string) {
      const { maintenance } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-${suffix}`,
          message: "announcement",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      return maintenance;
    }

    test("creates, edits, deletes, stamps attribution, touches parent, audits", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...teamCtx, db: tx };
        // a second actor on the same workspace: every timeline write must
        // flip the parent's `updatedBy`, which the creator alone cannot show
        const editorCtx = {
          ...makeUserCtx(teamCtx.workspace, { userId: 2 }),
          db: tx,
        };
        const parent = await createParent(ctx, "updates");
        const before = await getMaintenance({ ctx, input: { id: parent.id } });
        expect(before.updates.map((u) => u.message)).toEqual(["announcement"]);
        expect(before.updatedBy).toBe(1);

        const date = new Date("2026-06-20T00:15:00.000Z");
        const created = await addMaintenanceUpdate({
          ctx: editorCtx,
          input: { maintenanceId: parent.id, message: "work started", date },
        });
        expect(created.message).toBe("work started");
        expect(created.date.getTime()).toBe(date.getTime());
        expect(created.createdBy).toBe(2);
        expect(created.updatedBy).toBe(2);
        const afterAdd = await getMaintenance({
          ctx,
          input: { id: parent.id },
        });
        expect(afterAdd.updatedBy).toBe(2);

        const edited = await updateMaintenanceUpdate({
          ctx,
          input: { id: created.id, message: "work resumed" },
        });
        expect(edited.message).toBe("work resumed");
        expect(edited.date.getTime()).toBe(date.getTime());

        // `message` follows the newest update by date — the backdated note
        // does not become the public message
        const full = await getMaintenance({ ctx, input: { id: parent.id } });
        expect(full.message).toBe("announcement");
        expect(full.updates.map((u) => u.message)).toEqual([
          "announcement",
          "work resumed",
        ]);
        // the edit by user 1 flipped the parent back from the editor
        expect(full.updatedBy).toBe(1);

        await deleteMaintenanceUpdate({
          ctx: editorCtx,
          input: { id: created.id },
        });
        const gone = await tx
          .select()
          .from(maintenanceUpdate)
          .where(eq(maintenanceUpdate.id, created.id))
          .get();
        expect(gone).toBeUndefined();
        const afterDelete = await getMaintenance({
          ctx,
          input: { id: parent.id },
        });
        expect(afterDelete.updatedBy).toBe(2);

        for (const action of [
          "maintenance_update.create",
          "maintenance_update.update",
          "maintenance_update.delete",
        ] as const) {
          await expectAuditRow({
            workspaceId: teamCtx.workspace.id,
            action,
            entityType: "maintenance_update",
            entityId: created.id,
            db: tx,
          });
        }
      });
    });

    test("rejects future-dated updates", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...teamCtx, db: tx };
        const parent = await createParent(ctx, "future-update");
        const future = new Date(Date.now() + 10 * 60 * 1000);
        await expect(
          addMaintenanceUpdate({
            ctx,
            input: { maintenanceId: parent.id, message: "later", date: future },
          }),
        ).rejects.toThrow("Date cannot be in the future.");
        const [first] = (
          await getMaintenance({ ctx, input: { id: parent.id } })
        ).updates;
        await expect(
          updateMaintenanceUpdate({
            ctx,
            input: { id: first.id, date: future },
          }),
        ).rejects.toThrow("Date cannot be in the future.");
      });
    });

    test("the last update cannot be removed", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...teamCtx, db: tx };
        const parent = await createParent(ctx, "last-update");
        const note = await addMaintenanceUpdate({
          ctx,
          input: {
            maintenanceId: parent.id,
            message: "note",
            date: new Date(Date.now() + 1000),
          },
        });
        let full = await getMaintenance({ ctx, input: { id: parent.id } });
        expect(full.message).toBe("note");

        await deleteMaintenanceUpdate({ ctx, input: { id: note.id } });
        full = await getMaintenance({ ctx, input: { id: parent.id } });
        expect(full.updates).toHaveLength(1);
        expect(full.message).toBe("announcement");

        await expect(
          deleteMaintenanceUpdate({ ctx, input: { id: full.updates[0].id } }),
        ).rejects.toBeInstanceOf(ConflictError);
      });
    });

    test("scopes update rows to the workspace", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...teamCtx, db: tx };
        const parent = await createParent(ctx, "scoped");
        const created = await addMaintenanceUpdate({
          ctx,
          input: { maintenanceId: parent.id, message: "team only" },
        });
        const foreign = { ...freeCtx, db: tx };

        await expect(
          addMaintenanceUpdate({
            ctx: foreign,
            input: { maintenanceId: parent.id, message: "nope" },
          }),
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          updateMaintenanceUpdate({
            ctx: foreign,
            input: { id: created.id, message: "nope" },
          }),
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          deleteMaintenanceUpdate({ ctx: foreign, input: { id: created.id } }),
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    test("rejects read-only actors", async () => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...teamCtx, db: tx };
        const parent = await createParent(ctx, "read-only");
        const created = await addMaintenanceUpdate({
          ctx,
          input: { maintenanceId: parent.id, message: "x" },
        });
        const readOnly = {
          ...makeApiKeyCtx(teamCtx.workspace, {
            keyId: "k-read",
            userId: 1,
            scopes: ["read"],
          }),
          db: tx,
        };

        await expect(
          addMaintenanceUpdate({
            ctx: readOnly,
            input: { maintenanceId: parent.id, message: "x" },
          }),
        ).rejects.toBeInstanceOf(ForbiddenError);
        await expect(
          updateMaintenanceUpdate({
            ctx: readOnly,
            input: { id: created.id, message: "x" },
          }),
        ).rejects.toBeInstanceOf(ForbiddenError);
        await expect(
          deleteMaintenanceUpdate({ ctx: readOnly, input: { id: created.id } }),
        ).rejects.toBeInstanceOf(ForbiddenError);
      });
    });
  });

  test("throws when a later update belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: parent } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-notify-update-ws`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      const created = await addMaintenanceUpdate({
        ctx,
        input: { maintenanceId: parent.id, message: "x" },
      });
      await expect(
        notifyMaintenance({
          ctx: { ...freeCtx, db: tx },
          input: { maintenanceUpdateId: created.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("returns false when the plan disables status-subscribers", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { maintenance: parent } = await createMaintenance({
        ctx,
        input: {
          title: `${TEST_PREFIX}-notify-update-gated`,
          message: "m",
          ...futureRange(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      const created = await addMaintenanceUpdate({
        ctx,
        input: { maintenanceId: parent.id, message: "x" },
      });
      const gated: ServiceContext = {
        ...ctx,
        workspace: {
          ...teamCtx.workspace,
          limits: { ...teamCtx.workspace.limits, "status-subscribers": false },
        },
      };
      expect(
        await notifyMaintenance({
          ctx: gated,
          input: { maintenanceUpdateId: created.id },
        }),
      ).toBe(false);
    });
  });
});
