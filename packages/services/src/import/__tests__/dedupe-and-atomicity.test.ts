import { db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import type { PhaseResult } from "@openstatus/importers";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import {
  clearAuditLogFor,
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { NotFoundError } from "../../errors";
import {
  writeComponentsPhase,
  writeIncidentsPhase,
  writeMaintenancesPhase,
  writeMonitorsPhase,
  writePagePhase,
} from "../phase-writers";
import { previewImport } from "../preview";
import { PreviewImportInput } from "../schemas";

const TEST_PREFIX = "svc-import-dedupe";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamCtx = makeUserCtx(team.workspace, { userId: team.userId });
  const other = await createWorkspaceFixture("team");
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
});

async function insertPage(tx: DB, workspaceId: number, suffix: string) {
  return tx
    .insert(page)
    .values({
      workspaceId,
      title: `${TEST_PREFIX}-${suffix}`,
      description: `${TEST_PREFIX}-${suffix}-description`,
      slug: `${TEST_PREFIX}-${suffix}-${workspaceId}`,
      customDomain: "",
    })
    .returning()
    .get();
}

function incident(
  sourceId: string,
  title: string,
  pageId: number,
  workspaceId: number,
  dates: Date[],
): PhaseResult["resources"][number] {
  return {
    sourceId,
    name: title,
    status: "created",
    data: {
      report: { title, status: "resolved" as const, workspaceId, pageId },
      updates: dates.map((date, i) => ({
        status: "investigating" as const,
        message: `m${i}`,
        date,
      })),
      sourceComponentIds: [],
    },
  };
}

describe("writeIncidentsPhase idempotency key", () => {
  test("keeps distinct incidents that share a title, skips them on rerun", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await insertPage(tx, ctx.workspace.id, "same-title");
      const title = `${TEST_PREFIX}-degraded-performance`;
      const makePhase = (): PhaseResult => ({
        phase: "incidents",
        status: "completed",
        resources: [
          incident("inc_1", title, pageRow.id, ctx.workspace.id, [
            new Date("2024-01-01T00:00:00Z"),
          ]),
          incident("inc_2", title, pageRow.id, ctx.workspace.id, [
            new Date("2024-02-01T00:00:00Z"),
          ]),
        ],
      });
      const pc = { ctx, tx, provider: "statuspage" as const };

      const firstRun = makePhase();
      await writeIncidentsPhase(pc, firstRun, pageRow.id, new Map());
      expect(firstRun.resources.map((r) => r.status)).toEqual([
        "created",
        "created",
      ]);
      expect(firstRun.resources[0].openstatusId).not.toBe(
        firstRun.resources[1].openstatusId,
      );

      const secondRun = makePhase();
      await writeIncidentsPhase(pc, secondRun, pageRow.id, new Map());
      expect(secondRun.resources.map((r) => r.status)).toEqual([
        "skipped",
        "skipped",
      ]);
      expect(secondRun.resources.map((r) => r.openstatusId)).toEqual(
        firstRun.resources.map((r) => r.openstatusId),
      );

      const reports = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.pageId, pageRow.id))
        .all();
      expect(reports).toHaveLength(2);
    });
  });
});

describe("writeIncidentsPhase first-update match", () => {
  test("a later update at the same instant doesn't make a new incident a duplicate", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await insertPage(tx, ctx.workspace.id, "later-update");
      const title = `${TEST_PREFIX}-elevated-errors`;
      const pc = { ctx, tx, provider: "statuspage" as const };

      // First incident: starts Jan 1, its last update is Jan 2.
      const first: PhaseResult = {
        phase: "incidents",
        status: "completed",
        resources: [
          incident("inc_a", title, pageRow.id, ctx.workspace.id, [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-02T00:00:00Z"),
          ]),
        ],
      };
      await writeIncidentsPhase(pc, first, pageRow.id, new Map());

      // A different incident that *starts* when the first one last updated.
      const second: PhaseResult = {
        phase: "incidents",
        status: "completed",
        resources: [
          incident("inc_b", title, pageRow.id, ctx.workspace.id, [
            new Date("2024-01-02T00:00:00Z"),
          ]),
        ],
      };
      await writeIncidentsPhase(pc, second, pageRow.id, new Map());

      expect(second.resources[0].status).toBe("created");
      expect(second.resources[0].openstatusId).not.toBe(
        first.resources[0].openstatusId,
      );
    });
  });
});

// These run on the committed db: inside `withTestTransaction` the writers
// reuse the test's transaction, so a failed resource could not roll back on
// its own and the half-written rows would stay visible.
describe("per-resource atomicity", () => {
  let pageId: number;

  beforeAll(async () => {
    pageId = (await insertPage(db, teamCtx.workspace.id, "atomic")).id;
  });

  afterAll(async () => {
    const reports = await db
      .select({ id: statusReport.id })
      .from(statusReport)
      .where(eq(statusReport.pageId, pageId))
      .all();
    const reportIds = reports.map((r) => r.id);
    const updates = reportIds.length
      ? await db
          .select({ id: statusReportUpdate.id })
          .from(statusReportUpdate)
          .where(inArray(statusReportUpdate.statusReportId, reportIds))
          .all()
      : [];
    const maintenances = await db
      .select({ id: maintenance.id })
      .from(maintenance)
      .where(eq(maintenance.pageId, pageId))
      .all();
    const maintenanceIds = maintenances.map((m) => m.id);
    const mUpdates = maintenanceIds.length
      ? await db
          .select({ id: maintenanceUpdate.id })
          .from(maintenanceUpdate)
          .where(inArray(maintenanceUpdate.maintenanceId, maintenanceIds))
          .all()
      : [];

    await clearAuditLogFor({
      entityType: "status_report",
      entityIds: reportIds,
    });
    await clearAuditLogFor({
      entityType: "status_report_update",
      entityIds: updates.map((u) => u.id),
    });
    await clearAuditLogFor({
      entityType: "maintenance",
      entityIds: maintenanceIds,
    });
    await clearAuditLogFor({
      entityType: "maintenance_update",
      entityIds: mUpdates.map((u) => u.id),
    });
    if (reportIds.length) {
      await db.delete(statusReport).where(inArray(statusReport.id, reportIds));
    }
    if (maintenanceIds.length) {
      await db
        .delete(maintenance)
        .where(inArray(maintenance.id, maintenanceIds));
    }
    await db.delete(page).where(eq(page.id, pageId));
  });

  test("a failing update rolls back its report so a rerun can create it", async () => {
    const pc = { ctx: teamCtx, tx: db, provider: "statuspage" as const };
    const title = `${TEST_PREFIX}-atomic-report`;
    const dates = [
      new Date("2024-03-01T00:00:00Z"),
      new Date("2024-03-01T01:00:00Z"),
    ];

    const broken = incident(
      "inc_a",
      title,
      pageId,
      teamCtx.workspace.id,
      dates,
    );
    const brokenData = broken.data as {
      updates: Array<{ message: string | null }>;
    };
    brokenData.updates[1].message = null;
    const firstRun: PhaseResult = {
      phase: "incidents",
      status: "completed",
      resources: [broken],
    };
    await writeIncidentsPhase(pc, firstRun, pageId, new Map());
    expect(firstRun.resources[0].status).toBe("failed");

    const leftovers = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.pageId, pageId))
      .all();
    expect(leftovers).toHaveLength(0);

    const secondRun: PhaseResult = {
      phase: "incidents",
      status: "completed",
      resources: [
        incident("inc_a", title, pageId, teamCtx.workspace.id, dates),
      ],
    };
    await writeIncidentsPhase(pc, secondRun, pageId, new Map());
    expect(secondRun.resources[0].status).toBe("created");

    const updates = await db
      .select()
      .from(statusReportUpdate)
      .where(
        eq(
          statusReportUpdate.statusReportId,
          secondRun.resources[0].openstatusId as number,
        ),
      )
      .all();
    expect(updates).toHaveLength(2);
  });

  test("a failing component link rolls back its maintenance", async () => {
    const pc = { ctx: teamCtx, tx: db, provider: "statuspage" as const };
    const phase: PhaseResult = {
      phase: "maintenances",
      status: "completed",
      resources: [
        {
          sourceId: "mnt_a",
          name: `${TEST_PREFIX}-atomic-maintenance`,
          status: "created",
          data: {
            title: `${TEST_PREFIX}-atomic-maintenance`,
            message: "planned",
            from: new Date("2024-04-01T00:00:00Z"),
            to: new Date("2024-04-01T02:00:00Z"),
            workspaceId: teamCtx.workspace.id,
            pageId,
            sourceComponentIds: ["src_missing_row"],
          },
        },
      ],
    };

    // points at a page component that does not exist: the link insert
    // violates its foreign key after the maintenance row was written
    await writeMaintenancesPhase(
      pc,
      phase,
      pageId,
      new Map([["src_missing_row", 2_147_483_000]]),
    );
    expect(phase.resources[0].status).toBe("failed");

    const leftovers = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.pageId, pageId))
      .all();
    expect(leftovers).toHaveLength(0);
  });
});

describe("writeMaintenancesPhase", () => {
  test("dedupes source components collapsing onto one component", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await insertPage(tx, ctx.workspace.id, "mnt-dedupe");
      const comp = await tx
        .insert(pageComponent)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          name: `${TEST_PREFIX}-mnt-component`,
          type: "static",
        })
        .returning()
        .get();

      const phase: PhaseResult = {
        phase: "maintenances",
        status: "completed",
        resources: [
          {
            sourceId: "mnt_dup",
            name: `${TEST_PREFIX}-mnt-dup`,
            status: "created",
            data: {
              title: `${TEST_PREFIX}-mnt-dup`,
              message: "planned",
              from: new Date("2024-05-01T00:00:00Z"),
              to: new Date("2024-05-01T02:00:00Z"),
              workspaceId: ctx.workspace.id,
              pageId: pageRow.id,
              sourceComponentIds: ["src_a", "src_b"],
            },
          },
        ],
      };
      await writeMaintenancesPhase(
        { ctx, tx, provider: "statuspage" },
        phase,
        pageRow.id,
        new Map([
          ["src_a", comp.id],
          ["src_b", comp.id],
        ]),
      );
      expect(phase.resources[0].status).toBe("created");
    });
  });
});

describe("writeComponentsPhase idempotency key", () => {
  test("keeps same-named components in different groups apart", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await insertPage(tx, ctx.workspace.id, "components");
      const [eu, us] = await Promise.all(
        ["eu", "us"].map((name) =>
          tx
            .insert(pageComponentGroup)
            .values({ workspaceId: ctx.workspace.id, pageId: pageRow.id, name })
            .returning()
            .get(),
        ),
      );
      const groupIdMap = new Map([
        ["grp_eu", eu.id],
        ["grp_us", us.id],
      ]);
      const component = (sourceId: string, sourceGroupId: string) => ({
        sourceId,
        name: "API",
        status: "created" as const,
        data: {
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          type: "static" as const,
          monitorId: null,
          name: "API",
          description: null,
          order: 0,
          sourceGroupId,
        },
      });
      const makePhase = (): PhaseResult => ({
        phase: "components",
        status: "completed",
        resources: [
          component("cmp_eu", "grp_eu"),
          component("cmp_us", "grp_us"),
        ],
      });
      const pc = { ctx, tx, provider: "statuspage" as const };

      const firstMap = new Map<string, number>();
      await writeComponentsPhase(
        pc,
        makePhase(),
        pageRow.id,
        groupIdMap,
        firstMap,
      );
      expect(firstMap.get("cmp_eu")).not.toBe(firstMap.get("cmp_us"));

      const secondMap = new Map<string, number>();
      const secondRun = makePhase();
      await writeComponentsPhase(
        pc,
        secondRun,
        pageRow.id,
        groupIdMap,
        secondMap,
      );
      expect(secondRun.resources.map((r) => r.status)).toEqual([
        "skipped",
        "skipped",
      ]);
      expect(secondMap).toEqual(firstMap);
    });
  });
});

describe("writeMonitorsPhase idempotency key", () => {
  test("keeps distinct monitors on the same url apart", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const url = `https://${TEST_PREFIX}.example.com/health`;
      const source = (sourceId: string, name: string) => ({
        sourceId,
        name,
        status: "created" as const,
        data: {
          workspaceId: ctx.workspace.id,
          jobType: "http",
          periodicity: "10m",
          status: "active",
          active: false,
          regions: "ams",
          url,
          name,
          description: "",
          headers: "[]",
          body: "",
          method: "GET",
          timeout: 45000,
          sourceMonitorGroupId: null,
        },
      });
      const makePhase = (): PhaseResult => ({
        phase: "monitors",
        status: "completed",
        resources: [
          source("mon_get", `${TEST_PREFIX}-get`),
          source("mon_auth", `${TEST_PREFIX}-auth`),
        ],
      });
      const pc = { ctx, tx, provider: "checkly" as const };

      const firstMap = new Map<string, number>();
      await writeMonitorsPhase(pc, makePhase(), firstMap);
      expect(firstMap.get("mon_get")).not.toBe(firstMap.get("mon_auth"));

      const secondMap = new Map<string, number>();
      const secondRun = makePhase();
      await writeMonitorsPhase(pc, secondRun, secondMap);
      expect(secondRun.resources.map((r) => r.status)).toEqual([
        "skipped",
        "skipped",
      ]);
      expect(secondMap).toEqual(firstMap);

      const rows = await tx
        .select()
        .from(monitor)
        .where(eq(monitor.url, url))
        .all();
      expect(
        rows.filter((r) => r.workspaceId === ctx.workspace.id),
      ).toHaveLength(2);
    });
  });
});

describe("writePagePhase into an existing page", () => {
  test("leaves the page's title and description untouched", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await insertPage(tx, ctx.workspace.id, "existing");
      const phase: PhaseResult = {
        phase: "page",
        status: "completed",
        resources: [
          {
            sourceId: "page_src",
            name: "Imported page",
            status: "created",
            data: {
              workspaceId: ctx.workspace.id,
              title: "Imported title",
              description: "Imported description",
              slug: "imported-slug",
              customDomain: "",
              published: true,
              icon: "",
            },
          },
        ],
      };

      const id = await writePagePhase(
        { ctx, tx, provider: "statuspage" },
        phase,
        pageRow.id,
      );
      expect(id).toBe(pageRow.id);
      expect(phase.resources[0].status).toBe("skipped");

      const after = await tx
        .select()
        .from(page)
        .where(eq(page.id, pageRow.id))
        .get();
      expect(after?.title).toBe(pageRow.title);
      expect(after?.description).toBe(pageRow.description);
    });
  });
});

describe("writePagePhase with a taken custom domain", () => {
  test("creates the page without the domain another page holds", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const domain = `${TEST_PREFIX}-${Date.now()}.example.com`;
      await tx
        .insert(page)
        .values({
          workspaceId: otherCtx.workspace.id,
          title: `${TEST_PREFIX}-holder`,
          description: "",
          slug: `${TEST_PREFIX}-holder-${Date.now()}`,
          customDomain: domain,
        })
        .run();
      const phase: PhaseResult = {
        phase: "page",
        status: "completed",
        resources: [
          {
            sourceId: "page_src",
            name: "Imported page",
            status: "created",
            data: {
              workspaceId: ctx.workspace.id,
              title: "Imported title",
              description: "",
              slug: `${TEST_PREFIX}-taken-domain-${Date.now()}`,
              customDomain: domain.toUpperCase(),
              published: true,
              icon: "",
            },
          },
        ],
      };

      const id = await writePagePhase(
        { ctx, tx, provider: "statuspage" },
        phase,
      );
      const created = await tx.select().from(page).where(eq(page.id, id)).get();
      expect(created?.customDomain).toBe("");
      expect(phase.resources[0].error).toContain("already used");
    });
  });
});

describe("previewImport", () => {
  test("rejects a pageId from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const foreignPage = await insertPage(
        tx,
        otherCtx.workspace.id,
        "foreign",
      );
      await expect(
        previewImport({
          ctx: { ...teamCtx, db: tx },
          input: PreviewImportInput.parse({
            provider: "statuspage",
            apiKey: "unused",
            statuspagePageId: "unused",
            pageId: foreignPage.id,
          }),
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
