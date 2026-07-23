import { eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { PhaseResult } from "@openstatus/importers";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { writeIncidentsPhase } from "../phase-writers";

const TEST_PREFIX = "svc-import-incidents-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("writeIncidentsPhase componentImpacts", () => {
  test("writes impact rows per update and unions membership", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };

      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: `${TEST_PREFIX}-page`,
          description: "",
          slug: `${TEST_PREFIX}-page-slug`,
          customDomain: "",
        })
        .returning()
        .get();

      const [compA, compB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          tx
            .insert(pageComponent)
            .values({
              workspaceId: ctx.workspace.id,
              pageId: pageRow.id,
              name: `${TEST_PREFIX}-component-${suffix}`,
              type: "static",
            })
            .returning()
            .get(),
        ),
      );

      const componentIdMap = new Map([
        ["src_a", compA.id],
        ["src_b", compB.id],
      ]);

      const phase: PhaseResult = {
        phase: "incidents",
        status: "completed",
        resources: [
          {
            sourceId: "inc_1",
            name: `${TEST_PREFIX}-incident`,
            status: "created",
            data: {
              report: {
                title: `${TEST_PREFIX}-report`,
                status: "resolved" as const,
                workspaceId: ctx.workspace.id,
                pageId: pageRow.id,
              },
              updates: [
                {
                  status: "investigating" as const,
                  message: "m1",
                  date: new Date("2024-01-01T00:00:00Z"),
                  componentImpacts: [
                    {
                      sourceComponentId: "src_a",
                      impact: "major_outage" as const,
                    },
                  ],
                },
                {
                  status: "resolved" as const,
                  message: "m2",
                  date: new Date("2024-01-01T02:00:00Z"),
                  componentImpacts: [
                    {
                      sourceComponentId: "src_a",
                      impact: "operational" as const,
                    },
                    // not in componentIdMap: skipped without failing
                    {
                      sourceComponentId: "src_missing",
                      impact: "major_outage" as const,
                    },
                  ],
                },
              ],
              sourceComponentIds: ["src_b"],
            },
          },
        ],
      };

      await writeIncidentsPhase(
        { ctx, tx, provider: "statuspage" },
        phase,
        pageRow.id,
        componentIdMap,
      );

      expect(phase.resources[0].status).toBe("created");
      const reportId = phase.resources[0].openstatusId;
      expect(reportId).toBeGreaterThan(0);

      const report = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, reportId as number))
        .get();
      expect(report?.title).toBe(`${TEST_PREFIX}-report`);

      const updates = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, reportId as number))
        .all();
      expect(updates).toHaveLength(2);

      const sorted = [...updates].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const impactRowsFor = async (updateId: number) =>
        tx
          .select()
          .from(statusReportUpdateToPageComponents)
          .where(
            eq(
              statusReportUpdateToPageComponents.statusReportUpdateId,
              updateId,
            ),
          )
          .all();

      const firstRows = await impactRowsFor(sorted[0].id);
      expect(firstRows).toHaveLength(1);
      expect(firstRows[0].pageComponentId).toBe(compA.id);
      expect(firstRows[0].impact).toBe("major_outage");

      const lastRows = await impactRowsFor(sorted[1].id);
      expect(lastRows).toHaveLength(1);
      expect(lastRows[0].pageComponentId).toBe(compA.id);
      expect(lastRows[0].impact).toBe("operational");

      // membership = sourceComponentIds ∪ impact-named components
      const membership = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(
          eq(statusReportsToPageComponents.statusReportId, reportId as number),
        )
        .all();
      expect(membership.map((m) => m.pageComponentId).sort()).toEqual(
        [compA.id, compB.id].sort(),
      );
    });
  });

  test("dedupes source ids collapsing onto one component (worst impact wins)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };

      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: `${TEST_PREFIX}-collapse-page`,
          description: "",
          slug: `${TEST_PREFIX}-collapse-page-slug`,
          customDomain: "",
        })
        .returning()
        .get();

      const comp = await tx
        .insert(pageComponent)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          name: `${TEST_PREFIX}-collapse-component`,
          type: "static",
        })
        .returning()
        .get();

      // the components phase dedupes by (name, pageId): two source ids → one row
      const componentIdMap = new Map([
        ["src_a1", comp.id],
        ["src_a2", comp.id],
      ]);

      const phase: PhaseResult = {
        phase: "incidents",
        status: "completed",
        resources: [
          {
            sourceId: "inc_collapse",
            name: `${TEST_PREFIX}-collapse-incident`,
            status: "created",
            data: {
              report: {
                title: `${TEST_PREFIX}-collapse-report`,
                status: "investigating" as const,
                workspaceId: ctx.workspace.id,
                pageId: pageRow.id,
              },
              updates: [
                {
                  status: "investigating" as const,
                  message: "m1",
                  date: new Date("2024-01-01T00:00:00Z"),
                  componentImpacts: [
                    {
                      sourceComponentId: "src_a1",
                      impact: "degraded_performance" as const,
                    },
                    {
                      sourceComponentId: "src_a2",
                      impact: "major_outage" as const,
                    },
                  ],
                },
              ],
              sourceComponentIds: ["src_a1", "src_a2"],
            },
          },
        ],
      };

      await writeIncidentsPhase(
        { ctx, tx, provider: "statuspage" },
        phase,
        pageRow.id,
        componentIdMap,
      );

      expect(phase.resources[0].status).toBe("created");
      expect(phase.resources[0].error).toBeUndefined();
      const reportId = phase.resources[0].openstatusId as number;

      const updates = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, reportId))
        .all();
      expect(updates).toHaveLength(1);

      const impactRows = await tx
        .select()
        .from(statusReportUpdateToPageComponents)
        .where(
          eq(
            statusReportUpdateToPageComponents.statusReportUpdateId,
            updates[0].id,
          ),
        )
        .all();
      expect(impactRows).toHaveLength(1);
      expect(impactRows[0].pageComponentId).toBe(comp.id);
      expect(impactRows[0].impact).toBe("major_outage");

      const membership = await tx
        .select()
        .from(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, reportId))
        .all();
      expect(membership).toHaveLength(1);
      expect(membership[0].pageComponentId).toBe(comp.id);
    });
  });

  test("skips impact rows on rerun (report already exists)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };

      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: `${TEST_PREFIX}-rerun-page`,
          description: "",
          slug: `${TEST_PREFIX}-rerun-page-slug`,
          customDomain: "",
        })
        .returning()
        .get();

      const comp = await tx
        .insert(pageComponent)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          name: `${TEST_PREFIX}-rerun-component`,
          type: "static",
        })
        .returning()
        .get();

      const componentIdMap = new Map([["src_a", comp.id]]);
      const makePhase = (): PhaseResult => ({
        phase: "incidents",
        status: "completed",
        resources: [
          {
            sourceId: "inc_rerun",
            name: `${TEST_PREFIX}-rerun-incident`,
            status: "created",
            data: {
              report: {
                title: `${TEST_PREFIX}-rerun-report`,
                status: "investigating" as const,
                workspaceId: ctx.workspace.id,
                pageId: pageRow.id,
              },
              updates: [
                {
                  status: "investigating" as const,
                  message: "m1",
                  date: new Date("2024-01-01T00:00:00Z"),
                  componentImpacts: [
                    {
                      sourceComponentId: "src_a",
                      impact: "partial_outage" as const,
                    },
                  ],
                },
              ],
              sourceComponentIds: ["src_a"],
            },
          },
        ],
      });

      const pc = { ctx, tx, provider: "statuspage" as const };
      const firstRun = makePhase();
      await writeIncidentsPhase(pc, firstRun, pageRow.id, componentIdMap);
      expect(firstRun.resources[0].status).toBe("created");
      const reportId = firstRun.resources[0].openstatusId as number;

      const secondRun = makePhase();
      await writeIncidentsPhase(pc, secondRun, pageRow.id, componentIdMap);
      expect(secondRun.resources[0].status).toBe("skipped");

      // updates and their impact rows are written only on the creating run
      const updates = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, reportId))
        .all();
      expect(updates).toHaveLength(1);

      const impactRows = await tx
        .select()
        .from(statusReportUpdateToPageComponents)
        .where(
          eq(
            statusReportUpdateToPageComponents.statusReportUpdateId,
            updates[0].id,
          ),
        )
        .all();
      expect(impactRows).toHaveLength(1);
      expect(impactRows[0].impact).toBe("partial_outage");
    });
  });
});
