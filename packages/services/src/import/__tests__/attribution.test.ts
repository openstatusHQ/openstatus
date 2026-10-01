import { eq } from "@openstatus/db";
import {
  maintenance,
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import type { PhaseResult } from "@openstatus/importers";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { writeIncidentsPhase, writeMaintenancesPhase } from "../phase-writers";

const TEST_PREFIX = "svc-import-attribution";

let teamCtx: ServiceContext;
let ownerId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  ownerId = fixture.userId;
  teamCtx = makeUserCtx(fixture.workspace, { userId: ownerId });
});

describe("import stamps the importing user", () => {
  test("status reports, their updates and maintenances", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: `${TEST_PREFIX}-page`,
          description: "",
          slug: `${TEST_PREFIX}-${ctx.workspace.id}`,
          customDomain: "",
        })
        .returning()
        .get();

      const incidents: PhaseResult = {
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
                  status: "resolved" as const,
                  message: "done",
                  date: new Date("2024-01-01T00:00:00Z"),
                },
              ],
              sourceComponentIds: [],
            },
          },
        ],
      };
      await writeIncidentsPhase(
        { ctx, tx, provider: "statuspage" },
        incidents,
        pageRow.id,
        new Map(),
      );
      expect(incidents.resources[0].status).toBe("created");
      const reportId = incidents.resources[0].openstatusId as number;
      const report = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, reportId))
        .get();
      expect(report?.createdBy).toBe(ownerId);
      expect(report?.updatedBy).toBe(ownerId);
      const updates = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, reportId))
        .all();
      expect(updates.map((u) => [u.createdBy, u.updatedBy])).toEqual([
        [ownerId, ownerId],
      ]);

      const maintenances: PhaseResult = {
        phase: "maintenances",
        status: "completed",
        resources: [
          {
            sourceId: "mnt_1",
            name: `${TEST_PREFIX}-maintenance`,
            status: "created",
            data: {
              title: `${TEST_PREFIX}-maintenance`,
              message: "planned",
              from: new Date("2024-02-01T00:00:00Z"),
              to: new Date("2024-02-01T01:00:00Z"),
              workspaceId: ctx.workspace.id,
              pageId: pageRow.id,
              sourceComponentIds: [],
            },
          },
        ],
      };
      await writeMaintenancesPhase(
        { ctx, tx, provider: "statuspage" },
        maintenances,
        pageRow.id,
        new Map(),
      );
      expect(maintenances.resources[0].status).toBe("created");
      const row = await tx
        .select()
        .from(maintenance)
        .where(
          eq(maintenance.id, maintenances.resources[0].openstatusId as number),
        )
        .get();
      expect(row?.createdBy).toBe(ownerId);
      expect(row?.updatedBy).toBe(ownerId);
    });
  });
});
