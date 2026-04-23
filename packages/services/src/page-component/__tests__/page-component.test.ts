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
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
} from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { deletePageComponent } from "../delete";
import { listPageComponents } from "../list";
import { updatePageComponentOrder } from "../update-order";

const TEST_PREFIX = "svc-page-component-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testPageId: number;
let teamMonitorId: number;
let freeMonitorId: number;
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;
const createdComponentIds: number[] = [];

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
      description: "test",
      slug: `${TEST_PREFIX}-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = pageRow.id;

  const teamMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: team.id,
      active: true,
      url: "https://example.com",
      name: `${TEST_PREFIX}-team-monitor`,
      method: "GET",
      periodicity: "10m",
      regions: "ams",
    })
    .returning()
    .get();
  teamMonitorId = teamMonitor.id;

  const freeMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: free.id,
      active: true,
      url: "https://example.com",
      name: `${TEST_PREFIX}-free-monitor`,
      method: "GET",
      periodicity: "10m",
      regions: "ams",
    })
    .returning()
    .get();
  freeMonitorId = freeMonitor.id;
});

afterAll(async () => {
  if (createdComponentIds.length > 0) {
    await db
      .delete(pageComponent)
      .where(inArray(pageComponent.id, createdComponentIds))
      .catch(() => undefined);
  }
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.pageId, testPageId))
    .catch(() => undefined);
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.pageId, testPageId))
    .catch(() => undefined);
  await db
    .delete(monitor)
    .where(inArray(monitor.id, [teamMonitorId, freeMonitorId]))
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
});

afterEach(() => {
  auditReset();
});

describe("updatePageComponentOrder", () => {
  test("creates monitor + static components and a group", async () => {
    await updatePageComponentOrder({
      ctx: teamCtx,
      input: {
        pageId: testPageId,
        components: [
          {
            order: 0,
            name: `${TEST_PREFIX}-monitor-cmp`,
            type: "monitor",
            monitorId: teamMonitorId,
          },
          {
            order: 1,
            name: `${TEST_PREFIX}-static-cmp`,
            type: "static",
          },
        ],
        groups: [
          {
            order: 2,
            name: `${TEST_PREFIX}-group`,
            defaultOpen: false,
            components: [
              {
                order: 0,
                name: `${TEST_PREFIX}-grouped-static`,
                type: "static",
              },
            ],
          },
        ],
      },
    });

    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, testPageId))
      .all();
    for (const c of components) createdComponentIds.push(c.id);
    const groups = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.pageId, testPageId))
      .all();
    expect(components).toHaveLength(3);
    expect(groups).toHaveLength(1);

    await expectAuditRow(auditBuffer, {
      action: "page_component.update_order",
      entityType: "page",
      entityId: testPageId,
    });
  });

  test("rejects cross-workspace monitorId with ForbiddenError", async () => {
    await expect(
      updatePageComponentOrder({
        ctx: teamCtx,
        input: {
          pageId: testPageId,
          components: [
            {
              order: 0,
              name: `${TEST_PREFIX}-cross-ws`,
              type: "monitor",
              monitorId: freeMonitorId,
            },
          ],
          groups: [],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects cross-workspace pageId with ForbiddenError", async () => {
    await expect(
      updatePageComponentOrder({
        ctx: freeCtx,
        input: {
          pageId: testPageId, // team's page
          components: [],
          groups: [],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listPageComponents", () => {
  test("respects workspace isolation", async () => {
    const teamResult = await listPageComponents({
      ctx: teamCtx,
      input: { pageId: testPageId, order: "asc" },
    });
    expect(teamResult.length).toBeGreaterThan(0);

    const freeResult = await listPageComponents({
      ctx: freeCtx,
      input: { pageId: testPageId, order: "asc" },
    });
    expect(freeResult).toHaveLength(0);
  });
});

describe("deletePageComponent", () => {
  test("throws NotFoundError for cross-workspace id", async () => {
    const [anyComponent] = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, testPageId))
      .all();
    if (!anyComponent) {
      throw new Error("test setup broken: no components present");
    }

    await expect(
      deletePageComponent({
        ctx: freeCtx,
        input: { id: anyComponent.id },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
