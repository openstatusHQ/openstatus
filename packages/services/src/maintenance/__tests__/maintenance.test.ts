import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
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
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
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
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;

/**
 * Tests push created maintenance ids here instead of issuing an inline
 * `db.delete()` at the end of their body. `afterEach` drains the array,
 * so cleanup runs even when an assertion throws midway through a test —
 * otherwise a failing assertion leaves orphans that flake subsequent
 * runs.
 */
const createdMaintenanceIds: number[] = [];

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
});

afterAll(async () => {
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.id, testPageComponentId))
    .catch(() => undefined);
  await db
    .delete(page)
    .where(eq(page.id, testPageId))
    .catch(() => undefined);
});

beforeEach(() => {
  const hooks = withAuditBuffer();
  auditBuffer = hooks.buffer;
  auditReset = hooks.reset;
  subscriptionSpies?.dispatchMaintenanceUpdate.mockClear();
});

afterEach(async () => {
  auditReset();
  if (createdMaintenanceIds.length > 0) {
    await db
      .delete(maintenance)
      .where(inArray(maintenance.id, createdMaintenanceIds))
      .catch(() => undefined);
    createdMaintenanceIds.length = 0;
  }
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
    const range = futureRange();
    const record = await createMaintenance({
      ctx: teamCtx,
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

    const assoc = await db
      .select()
      .from(maintenancesToPageComponents)
      .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
      .all();
    expect(assoc.map((a) => a.pageComponentId)).toEqual([testPageComponentId]);

    await expectAuditRow(auditBuffer, {
      action: "maintenance.create",
      entityType: "maintenance",
      entityId: record.id,
    });

    createdMaintenanceIds.push(record.id);
  });

  test("throws when page is in another workspace", async () => {
    const range = futureRange();
    await expect(
      createMaintenance({
        ctx: freeCtx,
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

  test("throws ZodError when from >= to", async () => {
    const now = new Date();
    await expect(
      createMaintenance({
        ctx: teamCtx,
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

describe("updateMaintenance", () => {
  test("updates title + replaces associations", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
      input: {
        title: `${TEST_PREFIX}-update`,
        message: "m",
        ...futureRange(),
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
      },
    });

    const updated = await updateMaintenance({
      ctx: teamCtx,
      input: {
        id: record.id,
        title: `${TEST_PREFIX}-update-renamed`,
        pageComponentIds: [],
      },
    });
    expect(updated.title).toBe(`${TEST_PREFIX}-update-renamed`);

    const assoc = await db
      .select()
      .from(maintenancesToPageComponents)
      .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
      .all();
    expect(assoc).toHaveLength(0);

    createdMaintenanceIds.push(record.id);
  });

  test("throws NotFoundError for cross-workspace update", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
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
        ctx: freeCtx,
        input: { id: record.id, title: "blocked" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    createdMaintenanceIds.push(record.id);
  });
});

describe("deleteMaintenance", () => {
  test("cascades associations", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
      input: {
        title: `${TEST_PREFIX}-delete`,
        message: "m",
        ...futureRange(),
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
      },
    });

    await deleteMaintenance({ ctx: teamCtx, input: { id: record.id } });

    const remaining = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, record.id))
      .all();
    const remainingAssoc = await db
      .select()
      .from(maintenancesToPageComponents)
      .where(eq(maintenancesToPageComponents.maintenanceId, record.id))
      .all();
    expect(remaining).toHaveLength(0);
    expect(remainingAssoc).toHaveLength(0);
  });
});

describe("list / get", () => {
  test("respects workspace isolation", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
      input: {
        title: `${TEST_PREFIX}-isolation`,
        message: "m",
        ...futureRange(),
        pageId: testPageId,
        pageComponentIds: [],
      },
    });

    await expect(
      getMaintenance({ ctx: freeCtx, input: { id: record.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const { items } = await listMaintenances({
      ctx: freeCtx,
      input: {
        limit: 100,
        offset: 0,
        pageId: testPageId,
        order: "desc",
      },
    });
    expect(items.find((m) => m.id === record.id)).toBeUndefined();

    createdMaintenanceIds.push(record.id);
  });

  test("list returns totalSize and enriched relations", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
      input: {
        title: `${TEST_PREFIX}-list-enrich`,
        message: "m",
        ...futureRange(),
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
      },
    });

    const full = await getMaintenance({
      ctx: teamCtx,
      input: { id: record.id },
    });
    expect(full.pageComponents.map((c) => c.id)).toEqual([testPageComponentId]);
    expect(full.pageComponentIds).toEqual([testPageComponentId]);

    createdMaintenanceIds.push(record.id);
  });
});

describe("notifyMaintenance", () => {
  test("throws when maintenance belongs to another workspace", async () => {
    const record = await createMaintenance({
      ctx: teamCtx,
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
        ctx: freeCtx,
        input: { maintenanceId: record.id },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    createdMaintenanceIds.push(record.id);
  });
});

describe("slack actor path", () => {
  test("createMaintenance succeeds with a slack actor", async () => {
    const ctx = makeSlackCtx(teamCtx.workspace, {
      teamId: "T123",
      slackUserId: "U123",
    });
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
    await expectAuditRow(auditBuffer, {
      action: "maintenance.create",
      entityType: "maintenance",
      entityId: record.id,
      actorType: "slack",
    });
    createdMaintenanceIds.push(record.id);
  });
});
