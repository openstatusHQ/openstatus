import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeSlackCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { createMaintenance } from "../create";
import { deleteMaintenance } from "../delete";
import { getMaintenance, listMaintenances } from "../list";
import { notifyMaintenance } from "../notify";
import { updateMaintenance } from "../update";

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
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
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

function futureRange(startIn = 60 * 60 * 1000) {
  const now = Date.now();
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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

  test("throws NotFoundError for cross-workspace update", async () => {
    await withTestTransaction(async (tx) => {
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
      const record = await createMaintenance({
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
});

describe("notifyMaintenance", () => {
  test("throws when maintenance belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const record = await createMaintenance({
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
          input: { maintenanceId: record.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("slack actor path", () => {
  test("createMaintenance succeeds with a slack actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeSlackCtx(teamCtx.workspace, {
          teamId: "T123",
          slackUserId: "U123",
        }),
        db: tx,
      };
      const record = await createMaintenance({
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
