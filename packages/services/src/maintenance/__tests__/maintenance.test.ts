import { db, eq, inArray } from "@openstatus/db";
import {
  maintenanceUpdate,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  test,
} from "@std/testing/bdd";

import {
  expectAuditRow,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSlackCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { addMaintenanceUpdate } from "../add-update";
import { createMaintenance } from "../create";
import { deleteMaintenance } from "../delete";
import { deleteMaintenanceUpdate } from "../delete-update";
import { getMaintenance, listMaintenances } from "../list";
import { notifyMaintenance } from "../notify";
import { notifyMaintenanceUpdate } from "../notify-update";
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
});

describe("notifyMaintenance", () => {
  test("throws when maintenance belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const { maintenance: record } = await createMaintenance({
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
      const parent = await createParent(ctx, "updates");
      const before = await getMaintenance({ ctx, input: { id: parent.id } });
      expect(before.updates.map((u) => u.message)).toEqual(["announcement"]);

      const date = new Date("2026-06-20T00:15:00.000Z");
      const created = await addMaintenanceUpdate({
        ctx,
        input: { maintenanceId: parent.id, message: "work started", date },
      });
      expect(created.message).toBe("work started");
      expect(created.date.getTime()).toBe(date.getTime());
      expect(created.createdBy).toBe(1);
      expect(created.updatedBy).toBe(1);

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
      expect(full.updatedBy).toBe(1);

      await deleteMaintenanceUpdate({ ctx, input: { id: created.id } });
      const gone = await tx
        .select()
        .from(maintenanceUpdate)
        .where(eq(maintenanceUpdate.id, created.id))
        .get();
      expect(gone).toBeUndefined();

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
      const [first] = (await getMaintenance({ ctx, input: { id: parent.id } }))
        .updates;
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

describe("notifyMaintenanceUpdate", () => {
  test("throws when the update belongs to another workspace", async () => {
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
        notifyMaintenanceUpdate({
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
        await notifyMaintenanceUpdate({
          ctx: gated,
          input: { maintenanceUpdateId: created.id },
        }),
      ).toBe(false);
    });
  });
});
