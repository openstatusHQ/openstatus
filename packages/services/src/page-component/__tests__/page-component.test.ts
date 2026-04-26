import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, inArray } from "@openstatus/db";
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
  withTestTransaction,
} from "../../../test/helpers";
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

describe("updatePageComponentOrder", () => {
  test("creates monitor + static components and a group", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await updatePageComponentOrder({
        ctx,
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

      const components = await tx
        .select()
        .from(pageComponent)
        .where(eq(pageComponent.pageId, testPageId))
        .all();
      const groups = await tx
        .select()
        .from(pageComponentGroup)
        .where(eq(pageComponentGroup.pageId, testPageId))
        .all();
      expect(components).toHaveLength(3);
      expect(groups).toHaveLength(1);

      // Per-entity audit emits — assert one representative of each kind.
      // The service writes one row per component / group, so every id in
      // `components` + `groups` should appear, not a single page-level row.
      const monitorComponent = components.find((c) => c.type === "monitor");
      expect(monitorComponent).toBeDefined();
      if (!monitorComponent) throw new Error("unreachable");
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component.create",
        entityType: "page_component",
        entityId: monitorComponent.id,
        db: tx,
      });

      const group = groups[0];
      expect(group).toBeDefined();
      if (!group) throw new Error("unreachable");
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component_group.create",
        entityType: "page_component_group",
        entityId: group.id,
        db: tx,
      });
    });
  });

  test("rejects cross-workspace monitorId with ForbiddenError", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
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
  });

  test("rejects cross-workspace pageId with ForbiddenError", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        updatePageComponentOrder({
          ctx: { ...freeCtx, db: tx },
          input: {
            pageId: testPageId, // team's page
            components: [],
            groups: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("upserts monitor components without creating duplicates", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      // The `(pageId, monitorId)` unique constraint + `onConflictDoUpdate`
      // is the riskiest path in this service: a regression here would
      // silently insert duplicate rows on every re-invocation. Run the
      // service twice with the same `monitorId` — expect exactly one
      // row, with the second call's values winning the update.
      await updatePageComponentOrder({
        ctx,
        input: {
          pageId: testPageId,
          components: [
            {
              order: 0,
              name: `${TEST_PREFIX}-upsert-initial`,
              type: "monitor",
              monitorId: teamMonitorId,
            },
          ],
          groups: [],
        },
      });
      await updatePageComponentOrder({
        ctx,
        input: {
          pageId: testPageId,
          components: [
            {
              order: 5,
              name: `${TEST_PREFIX}-upsert-renamed`,
              type: "monitor",
              monitorId: teamMonitorId,
            },
          ],
          groups: [],
        },
      });

      const rows = await tx
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, testPageId),
            eq(pageComponent.type, "monitor"),
            eq(pageComponent.monitorId, teamMonitorId),
          ),
        )
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe(`${TEST_PREFIX}-upsert-renamed`);
      expect(rows[0]?.order).toBe(5);
    });
  });
});

describe("listPageComponents", () => {
  test("respects workspace isolation", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      // Seed at least one component on the team's page so the team-side
      // listing has something to return.
      await updatePageComponentOrder({
        ctx: teamCtxTx,
        input: {
          pageId: testPageId,
          components: [
            {
              order: 0,
              name: `${TEST_PREFIX}-list-cmp`,
              type: "static",
            },
          ],
          groups: [],
        },
      });

      const teamResult = await listPageComponents({
        ctx: teamCtxTx,
        input: { pageId: testPageId, order: "asc" },
      });
      expect(teamResult.length).toBeGreaterThan(0);

      const freeResult = await listPageComponents({
        ctx: freeCtxTx,
        input: { pageId: testPageId, order: "asc" },
      });
      expect(freeResult).toHaveLength(0);
    });
  });
});

describe("deletePageComponent", () => {
  test("throws NotFoundError for cross-workspace id", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      // Seed a component on the team page so the cross-workspace delete
      // has a real target id rather than asserting against an empty page.
      await updatePageComponentOrder({
        ctx: teamCtxTx,
        input: {
          pageId: testPageId,
          components: [
            {
              order: 0,
              name: `${TEST_PREFIX}-delete-target`,
              type: "static",
            },
          ],
          groups: [],
        },
      });
      const [anyComponent] = await tx
        .select()
        .from(pageComponent)
        .where(eq(pageComponent.pageId, testPageId))
        .all();
      if (!anyComponent) {
        throw new Error("test setup broken: no components present");
      }

      await expect(
        deletePageComponent({
          ctx: { ...freeCtx, db: tx },
          input: { id: anyComponent.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
