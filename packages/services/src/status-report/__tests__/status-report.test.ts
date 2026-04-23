import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
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
import { addStatusReportUpdate } from "../add-update";
import { createStatusReport } from "../create";
import { deleteStatusReport, deleteStatusReportUpdate } from "../delete";
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
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;

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
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.pageId, testPageId))
    .catch(() => undefined);
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
  subscriptionSpies?.dispatchStatusReportUpdate.mockClear();
});

afterEach(() => {
  auditReset();
});

describe("createStatusReport", () => {
  test("creates report + initial update + associations and emits audit", async () => {
    const { statusReport: report, initialUpdate } = await createStatusReport({
      ctx: teamCtx,
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

    const assoc = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, report.id))
      .all();
    expect(assoc.map((a) => a.pageComponentId)).toEqual([testPageComponentId]);

    await expectAuditRow(auditBuffer, {
      action: "status_report.create",
      entityType: "status_report",
      entityId: report.id,
    });

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });

  test("throws NotFoundError when the page is not in the workspace", async () => {
    await expect(
      createStatusReport({
        ctx: freeCtx,
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

describe("addStatusReportUpdate", () => {
  test("appends an update and bumps parent status", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
        ctx: teamCtx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "moved to monitoring",
        },
      });

    expect(bumped.status).toBe("monitoring");
    expect(newUpdate.status).toBe("monitoring");
    expect(newUpdate.statusReportId).toBe(report.id);

    await expectAuditRow(auditBuffer, {
      action: "status_report.add_update",
      entityType: "status_report_update",
      entityId: newUpdate.id,
    });

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });

  test("throws NotFoundError for a status report in another workspace", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
        ctx: freeCtx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "cross-ws",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("resolveStatusReport", () => {
  test("appends a resolved update and flips parent status", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      ctx: teamCtx,
      input: { statusReportId: report.id, message: "all clear" },
    });
    expect(resolved.status).toBe("resolved");
    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("updateStatusReport", () => {
  test("updates title and replaces associations", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      ctx: teamCtx,
      input: {
        id: report.id,
        title: `${TEST_PREFIX}-update-renamed`,
        pageComponentIds: [],
      },
    });
    expect(updated.title).toBe(`${TEST_PREFIX}-update-renamed`);

    const assoc = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, report.id))
      .all();
    expect(assoc).toHaveLength(0);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("deleteStatusReport", () => {
  test("cascades updates + associations", async () => {
    const { statusReport: report, initialUpdate } = await createStatusReport({
      ctx: teamCtx,
      input: {
        title: `${TEST_PREFIX}-delete`,
        status: "investigating",
        message: "m",
        date: new Date(),
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
      },
    });

    await deleteStatusReport({ ctx: teamCtx, input: { id: report.id } });

    const remainingReport = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, report.id))
      .all();
    const remainingUpdate = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.id, initialUpdate.id))
      .all();
    const remainingAssoc = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, report.id))
      .all();
    expect(remainingReport).toHaveLength(0);
    expect(remainingUpdate).toHaveLength(0);
    expect(remainingAssoc).toHaveLength(0);
  });

  test("throws NotFoundError for cross-workspace delete", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      deleteStatusReport({ ctx: freeCtx, input: { id: report.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("deleteStatusReportUpdate", () => {
  test("removes a single update and emits audit", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      ctx: teamCtx,
      input: {
        statusReportId: report.id,
        status: "monitoring",
        message: "to be deleted",
      },
    });

    await deleteStatusReportUpdate({
      ctx: teamCtx,
      input: { id: newUpdate.id },
    });

    const remaining = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.id, newUpdate.id))
      .all();
    expect(remaining).toHaveLength(0);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("updateStatusReportUpdate", () => {
  test("edits message + date; returns updated row", async () => {
    const { statusReport: report, initialUpdate } = await createStatusReport({
      ctx: teamCtx,
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
      ctx: teamCtx,
      input: { id: initialUpdate.id, message: "after" },
    });
    expect(edited.message).toBe("after");

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });

  test("throws ForbiddenError for cross-workspace edit", async () => {
    const { statusReport: report, initialUpdate } = await createStatusReport({
      ctx: teamCtx,
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
        ctx: freeCtx,
        input: { id: initialUpdate.id, message: "blocked" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("listStatusReports / getStatusReport", () => {
  test("respects workspace isolation", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      getStatusReport({ ctx: freeCtx, input: { id: report.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const { items: freeItems } = await listStatusReports({
      ctx: freeCtx,
      input: {
        limit: 100,
        offset: 0,
        statuses: [],
        order: "desc",
        pageId: testPageId,
      },
    });
    expect(freeItems.find((r) => r.id === report.id)).toBeUndefined();

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });

  test("returns totalSize and enriched relations", async () => {
    const { statusReport: report } = await createStatusReport({
      ctx: teamCtx,
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
      ctx: teamCtx,
      input: { id: report.id },
    });
    expect(full.updates).toHaveLength(1);
    expect(full.pageComponents.map((c) => c.id)).toEqual([testPageComponentId]);
    expect(full.page?.id).toBe(testPageId);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("notifyStatusReport", () => {
  test("throws when update belongs to another workspace", async () => {
    const { statusReport: report, initialUpdate } = await createStatusReport({
      ctx: teamCtx,
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
        ctx: freeCtx,
        input: { statusReportUpdateId: initialUpdate.id },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});

describe("slack actor path", () => {
  test("createStatusReport succeeds with a slack actor", async () => {
    const ctx = makeSlackCtx(teamCtx.workspace, {
      teamId: "T123",
      slackUserId: "U123",
    });
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
    await expectAuditRow(auditBuffer, {
      action: "status_report.create",
      entityType: "status_report",
      entityId: report.id,
      actorType: "slack",
    });
    await db.delete(statusReport).where(eq(statusReport.id, report.id));
  });
});
