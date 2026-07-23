import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
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
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeSlackCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { addStatusReportUpdate } from "../add-update";
import { createStatusReport } from "../create";
import { deleteStatusReport, deleteStatusReportUpdate } from "../delete";
import { getCurrentImpactsForReport } from "../internal";
import { getStatusReport, listStatusReports } from "../list";
import { notifyStatusReport } from "../notify";
import { resolveStatusReport } from "../resolve";
import { updateStatusReport, updateStatusReportUpdate } from "../update";

// Subscription-dispatcher spies are installed by `test/preload.ts` and
// exposed on globalThis so we can assert notification dispatch without
// sending real emails.
const subscriptionSpies = (globalThis as Record<string, unknown>)
  .__subscriptionSpies as
  | {
      dispatchStatusReportUpdate: {
        mockClear: () => void;
        mock: { calls: unknown[][] };
      };
      dispatchMaintenanceUpdate: {
        mockClear: () => void;
        mock: { calls: unknown[][] };
      };
    }
  | undefined;

const TEST_PREFIX = "svc-status-report-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testPageId: number;
let testPageComponentId: number;
let testPageComponentId2: number;
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

  const componentRow2 = await db
    .insert(pageComponent)
    .values({
      workspaceId: team.id,
      pageId: testPageId,
      name: `${TEST_PREFIX}-component-2`,
      type: "static",
    })
    .returning()
    .get();
  testPageComponentId2 = componentRow2.id;

  const otherPageRow = await db
    .insert(page)
    .values({
      workspaceId: team.id,
      title: `${TEST_PREFIX}-other-page`,
      description: "test page",
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
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.pageId, testPageId))
    .catch(() => undefined);
  for (const componentId of [
    testPageComponentId,
    testPageComponentId2,
    otherPageComponentId,
  ]) {
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.id, componentId))
      .catch(() => undefined);
  }
  for (const pageId of [testPageId, otherPageId]) {
    await db
      .delete(page)
      .where(eq(page.id, pageId))
      .catch(() => undefined);
  }
});

beforeEach(() => {
  subscriptionSpies?.dispatchStatusReportUpdate.mockClear();
});

describe("createStatusReport", () => {
  test("creates report + initial update + associations and emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-create-happy`,
          status: "investigating",
          message: "starting investigation",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      expect(report.id).toBeGreaterThan(0);
      expect(report.title).toBe(`${TEST_PREFIX}-create-happy`);
      expect(report.pageId).toBe(testPageId);
      expect(initialUpdate.statusReportId).toBe(report.id);
      expect(initialUpdate.message).toBe("starting investigation");

      const assoc = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id))
        .all();
      expect(assoc.map((a) => a.pageComponentId)).toEqual([
        testPageComponentId,
      ]);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "status_report.create",
        entityType: "status_report",
        entityId: report.id,
        db: tx,
      });

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "status_report_update.create",
        entityType: "status_report_update",
        entityId: initialUpdate.id,
        db: tx,
      });
    });
  });

  test("throws NotFoundError when the page is not in the workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createStatusReport({
          ctx: { ...freeCtx, db: tx },
          input: {
            title: `${TEST_PREFIX}-create-cross-ws`,
            status: "investigating",
            message: "should fail",
            date: new Date(),
            pageId: testPageId, // page belongs to team workspace
            pageComponentIds: [],
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createStatusReport({
          ctx,
          input: {
            title: `${TEST_PREFIX}-read-only`,
            status: "investigating",
            message: "blocked",
            date: new Date(),
            pageId: testPageId,
            pageComponentIds: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("addStatusReportUpdate", () => {
  test("appends an update and bumps parent status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-add-update`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      const { statusReport: bumped, statusReportUpdate: newUpdate } =
        await addStatusReportUpdate({
          ctx,
          input: {
            statusReportId: report.id,
            status: "monitoring",
            message: "moved to monitoring",
          },
        });

      expect(bumped.status).toBe("monitoring");
      expect(newUpdate.status).toBe("monitoring");
      expect(newUpdate.statusReportId).toBe(report.id);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "status_report_update.create",
        entityType: "status_report_update",
        entityId: newUpdate.id,
        db: tx,
      });
    });
  });

  test("throws NotFoundError for a status report in another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const { statusReport: report } = await createStatusReport({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-cross-ws-add`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        addStatusReportUpdate({
          ctx: { ...freeCtx, db: tx },
          input: {
            statusReportId: report.id,
            status: "monitoring",
            message: "cross-ws",
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("resolveStatusReport", () => {
  test("appends a resolved update and flips parent status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-resolve`,
          status: "investigating",
          message: "oops",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      const { statusReport: resolved } = await resolveStatusReport({
        ctx,
        input: { statusReportId: report.id, message: "all clear" },
      });
      expect(resolved.status).toBe("resolved");
    });
  });
});

describe("updateStatusReport", () => {
  test("updates title and replaces associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-update`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const updated = await updateStatusReport({
        ctx,
        input: {
          id: report.id,
          title: `${TEST_PREFIX}-update-renamed`,
          pageComponentIds: [],
        },
      });
      expect(updated.title).toBe(`${TEST_PREFIX}-update-renamed`);

      const assoc = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id))
        .all();
      expect(assoc).toHaveLength(0);
      expect(updated.pageId).toBe(testPageId);
    });
  });
});

describe("deleteStatusReport", () => {
  test("cascades updates + associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-delete`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await deleteStatusReport({ ctx, input: { id: report.id } });

      const remainingReport = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, report.id))
        .all();
      const remainingUpdate = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.id, initialUpdate.id))
        .all();
      const remainingAssoc = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id))
        .all();
      expect(remainingReport).toHaveLength(0);
      expect(remainingUpdate).toHaveLength(0);
      expect(remainingAssoc).toHaveLength(0);
    });
  });

  test("throws NotFoundError for cross-workspace delete", async () => {
    await withTestTransaction(async (tx) => {
      const { statusReport: report } = await createStatusReport({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-cross-ws-delete`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        deleteStatusReport({
          ctx: { ...freeCtx, db: tx },
          input: { id: report.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("deleteStatusReportUpdate", () => {
  test("removes a single update and emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-delete-update`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      const { statusReportUpdate: newUpdate } = await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "to be deleted",
        },
      });

      await deleteStatusReportUpdate({
        ctx,
        input: { id: newUpdate.id },
      });

      const remaining = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.id, newUpdate.id))
        .all();
      expect(remaining).toHaveLength(0);
    });
  });
});

describe("updateStatusReportUpdate", () => {
  test("edits message + date; returns updated row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-edit-update`,
          status: "investigating",
          message: "before",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      const edited = await updateStatusReportUpdate({
        ctx,
        input: { id: initialUpdate.id, message: "after" },
      });
      expect(edited.message).toBe("after");
    });
  });

  test("throws ForbiddenError for cross-workspace edit", async () => {
    await withTestTransaction(async (tx) => {
      const { initialUpdate } = await createStatusReport({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-cross-ws-edit`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        updateStatusReportUpdate({
          ctx: { ...freeCtx, db: tx },
          input: { id: initialUpdate.id, message: "blocked" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("listStatusReports / getStatusReport", () => {
  test("respects workspace isolation", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx: teamCtxTx,
        input: {
          title: `${TEST_PREFIX}-isolation`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        getStatusReport({ ctx: freeCtxTx, input: { id: report.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const { items: freeItems } = await listStatusReports({
        ctx: freeCtxTx,
        input: {
          limit: 100,
          offset: 0,
          statuses: [],
          order: "desc",
          pageId: testPageId,
        },
      });
      expect(freeItems.find((r) => r.id === report.id)).toBeUndefined();
    });
  });

  test("returns totalSize and enriched relations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-list-enrich`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const full = await getStatusReport({
        ctx,
        input: { id: report.id },
      });
      expect(full.updates).toHaveLength(1);
      expect(full.pageComponents.map((c) => c.id)).toEqual([
        testPageComponentId,
      ]);
      expect(full.page?.id).toBe(testPageId);
    });
  });
});

describe("notifyStatusReport", () => {
  test("throws when update belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const { initialUpdate } = await createStatusReport({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-notify-cross-ws`,
          status: "investigating",
          message: "m",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });

      await expect(
        notifyStatusReport({
          ctx: { ...freeCtx, db: tx },
          input: { statusReportUpdateId: initialUpdate.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("slack actor path", () => {
  test("createStatusReport succeeds with a slack actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeSlackCtx(teamCtx.workspace, {
          teamId: "T123",
          slackUserId: "U123",
        }),
        db: tx,
      };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-slack`,
          status: "investigating",
          message: "via slack",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [],
        },
      });
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "status_report.create",
        entityType: "status_report",
        entityId: report.id,
        actorType: "slack",
        db: tx,
      });
    });
  });
});

describe("componentImpacts", () => {
  async function impactRowsForUpdate(tx: DB, statusReportUpdateId: number) {
    return tx
      .select()
      .from(statusReportUpdateToPageComponents)
      .where(
        eq(
          statusReportUpdateToPageComponents.statusReportUpdateId,
          statusReportUpdateId,
        ),
      )
      .all();
  }

  test("create writes impact rows for the initial update and unions membership", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-create`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
          componentImpacts: [
            { pageComponentId: testPageComponentId2, impact: "major_outage" },
          ],
        },
      });

      const rows = await impactRowsForUpdate(tx, initialUpdate.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].pageComponentId).toBe(testPageComponentId2);
      expect(rows[0].impact).toBe("major_outage");

      const membership = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id))
        .all();
      expect(membership.map((m) => m.pageComponentId).sort()).toEqual(
        [testPageComponentId, testPageComponentId2].sort(),
      );

      // impacts and membership surface in the audit snapshots (CHANGES UI)
      const updateAuditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report_update",
        entityId: String(initialUpdate.id),
        db: tx,
      });
      const updateHit = updateAuditRows.find(
        (r) => r.action === "status_report_update.create",
      );
      expect(updateHit?.after).toMatchObject({
        componentImpacts: [
          { pageComponentId: testPageComponentId2, impact: "major_outage" },
        ],
      });

      const reportAuditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report",
        entityId: String(report.id),
        db: tx,
      });
      const reportHit = reportAuditRows.find(
        (r) => r.action === "status_report.create",
      );
      expect(reportHit?.after).toMatchObject({
        pageComponentIds: [testPageComponentId, testPageComponentId2].sort(
          (a, b) => a - b,
        ),
      });
    });
  });

  test("create without componentImpacts writes zero impact rows (legacy)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-legacy`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const rows = await impactRowsForUpdate(tx, initialUpdate.id);
      expect(rows).toHaveLength(0);
    });
  });

  test("add-update naming a new component syncs membership and writes its impact", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-sync`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: testPageComponentId, impact: "partial_outage" },
          ],
        },
      });

      const { statusReportUpdate: newUpdate } = await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "identified",
          message: "second component affected",
          componentImpacts: [
            {
              pageComponentId: testPageComponentId2,
              impact: "degraded_performance",
            },
          ],
        },
      });

      const rows = await impactRowsForUpdate(tx, newUpdate.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].pageComponentId).toBe(testPageComponentId2);

      const membership = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id))
        .all();
      expect(membership.map((m) => m.pageComponentId).sort()).toEqual(
        [testPageComponentId, testPageComponentId2].sort(),
      );

      // omitted component keeps its prior impact via latest-update-naming-it
      const current = await getCurrentImpactsForReport(tx, report.id);
      expect(current.get(testPageComponentId)).toBe("partial_outage");
      expect(current.get(testPageComponentId2)).toBe("degraded_performance");
    });
  });

  test("resolve writes operational rows for still-affected components", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-resolve`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: testPageComponentId, impact: "major_outage" },
            {
              pageComponentId: testPageComponentId2,
              impact: "degraded_performance",
            },
          ],
        },
      });

      const { statusReportUpdate: resolving } = await resolveStatusReport({
        ctx,
        input: { statusReportId: report.id, message: "all clear" },
      });

      const rows = await impactRowsForUpdate(tx, resolving.id);
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.impact === "operational")).toBe(true);

      const current = await getCurrentImpactsForReport(tx, report.id);
      expect(current.get(testPageComponentId)).toBe("operational");
      expect(current.get(testPageComponentId2)).toBe("operational");
    });
  });

  test("resolve on a legacy report stays legacy (zero rows)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-resolve-legacy`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      const { statusReportUpdate: resolving } = await resolveStatusReport({
        ctx,
        input: { statusReportId: report.id, message: "all clear" },
      });

      const rows = await impactRowsForUpdate(tx, resolving.id);
      expect(rows).toHaveLength(0);
      expect((await getCurrentImpactsForReport(tx, report.id)).size).toBe(0);
    });
  });

  test("membership replacement prunes impact rows for removed components", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-prune`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: testPageComponentId, impact: "major_outage" },
            {
              pageComponentId: testPageComponentId2,
              impact: "degraded_performance",
            },
          ],
        },
      });

      await updateStatusReport({
        ctx,
        input: { id: report.id, pageComponentIds: [testPageComponentId] },
      });

      const rows = await impactRowsForUpdate(tx, initialUpdate.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].pageComponentId).toBe(testPageComponentId);

      // the fold must not resurrect the removed component
      const current = await getCurrentImpactsForReport(tx, report.id);
      expect(current.has(testPageComponentId2)).toBe(false);
      expect(current.get(testPageComponentId)).toBe("major_outage");
    });
  });

  test("clearing membership prunes all impact rows (report reads legacy)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-prune-all`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: testPageComponentId, impact: "partial_outage" },
          ],
        },
      });

      await updateStatusReport({
        ctx,
        input: { id: report.id, pageComponentIds: [] },
      });

      expect(await impactRowsForUpdate(tx, initialUpdate.id)).toHaveLength(0);
      expect((await getCurrentImpactsForReport(tx, report.id)).size).toBe(0);
    });
  });

  test("rejects impacts for components on a different page", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-cross-page`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await expect(
        addStatusReportUpdate({
          ctx,
          input: {
            statusReportId: report.id,
            status: "identified",
            message: "wrong page",
            componentImpacts: [
              { pageComponentId: otherPageComponentId, impact: "major_outage" },
            ],
          },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("updateStatusReportUpdate replaces the update's impact rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-edit`,
          status: "investigating",
          message: "initial",
          date: new Date(Date.now() - 60_000),
          pageId: testPageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: testPageComponentId, impact: "major_outage" },
          ],
        },
      });

      // edit without componentImpacts: rows untouched
      await updateStatusReportUpdate({
        ctx,
        input: { id: initialUpdate.id, message: "edited message" },
      });
      let rows = await impactRowsForUpdate(tx, initialUpdate.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].impact).toBe("major_outage");

      // edit with componentImpacts: full replace + membership sync
      await updateStatusReportUpdate({
        ctx,
        input: {
          id: initialUpdate.id,
          componentImpacts: [
            {
              pageComponentId: testPageComponentId2,
              impact: "degraded_performance",
            },
          ],
        },
      });
      rows = await impactRowsForUpdate(tx, initialUpdate.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].pageComponentId).toBe(testPageComponentId2);
      expect(rows[0].impact).toBe("degraded_performance");

      const membership = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(
          eq(
            statusReportsToPageComponents.statusReportId,
            initialUpdate.statusReportId,
          ),
        )
        .all();
      expect(membership.map((m) => m.pageComponentId)).toContain(
        testPageComponentId2,
      );

      const auditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report_update",
        entityId: String(initialUpdate.id),
        db: tx,
      });
      const hit = auditRows.find(
        (r) => r.action === "status_report_update.update",
      );
      expect(hit?.changedFields).toContain("componentImpacts");
      expect(hit?.before).toMatchObject({
        componentImpacts: [
          { pageComponentId: testPageComponentId, impact: "major_outage" },
        ],
      });
      expect(hit?.after).toMatchObject({
        componentImpacts: [
          {
            pageComponentId: testPageComponentId2,
            impact: "degraded_performance",
          },
        ],
      });
    });
  });

  test("membership-only updateStatusReport emits an audit diff", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-audit-membership`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await updateStatusReport({
        ctx,
        input: { id: report.id, pageComponentIds: [testPageComponentId2] },
      });

      const auditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report",
        entityId: String(report.id),
        db: tx,
      });
      const hit = auditRows.find((r) => r.action === "status_report.update");
      expect(hit).toBeDefined();
      expect(hit?.changedFields).toContain("pageComponentIds");
      expect(hit?.before).toMatchObject({
        pageComponentIds: [testPageComponentId],
      });
      expect(hit?.after).toMatchObject({
        pageComponentIds: [testPageComponentId2],
      });
    });
  });

  test("updateStatusReportUpdate rejects impacts on another page", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title: `${TEST_PREFIX}-impact-edit-cross`,
          status: "investigating",
          message: "initial",
          date: new Date(),
          pageId: testPageId,
          pageComponentIds: [testPageComponentId],
        },
      });

      await expect(
        updateStatusReportUpdate({
          ctx,
          input: {
            id: initialUpdate.id,
            componentImpacts: [
              { pageComponentId: otherPageComponentId, impact: "major_outage" },
            ],
          },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("rejects duplicate component ids in componentImpacts", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await expect(
        createStatusReport({
          ctx,
          input: {
            title: `${TEST_PREFIX}-impact-dupes`,
            status: "investigating",
            message: "initial",
            date: new Date(),
            pageId: testPageId,
            pageComponentIds: [],
            componentImpacts: [
              { pageComponentId: testPageComponentId, impact: "major_outage" },
              { pageComponentId: testPageComponentId, impact: "operational" },
            ],
          },
        }),
      ).rejects.toThrow();
    });
  });
});
