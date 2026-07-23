import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { NotFoundError } from "../../errors";
import { getPageComponentDailySummary } from "../get-daily-summary";

const TEST_PREFIX = "svc-page-component-daily-test";

let teamCtx: ServiceContext;
let workspaceId: number;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  workspaceId = team.id;
});

describe("getPageComponentDailySummary", () => {
  test("merges per-component uptime buckets with the event timeline", async () => {
    await withTestTransaction(async (tx) => {
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId,
          title: `${TEST_PREFIX}-page`,
          description: "test",
          slug: `${TEST_PREFIX}-${Date.now()}`,
          customDomain: "",
        })
        .returning()
        .get();

      const mon = await tx
        .insert(monitor)
        .values({
          workspaceId,
          active: true,
          url: "https://example.com",
          name: `${TEST_PREFIX}-monitor`,
          method: "GET",
          jobType: "http",
          periodicity: "10m",
          regions: "ams",
        })
        .returning()
        .get();

      const monitorComponent = await tx
        .insert(pageComponent)
        .values({
          workspaceId,
          pageId: pageRow.id,
          type: "monitor",
          monitorId: mon.id,
          name: "API",
          order: 0,
        })
        .returning()
        .get();

      const staticComponent = await tx
        .insert(pageComponent)
        .values({
          workspaceId,
          pageId: pageRow.id,
          type: "static",
          name: "Docs",
          order: 1,
        })
        .returning()
        .get();

      const now = new Date();
      const maint = await tx
        .insert(maintenance)
        .values({
          workspaceId,
          pageId: pageRow.id,
          title: "Planned maintenance",
          message: "rolling restart",
          from: new Date(now.getTime() - 3_600_000),
          to: new Date(now.getTime() + 3_600_000),
        })
        .returning()
        .get();
      await tx.insert(maintenancesToPageComponents).values({
        maintenanceId: maint.id,
        pageComponentId: monitorComponent.id,
      });

      const report = await tx
        .insert(statusReport)
        .values({
          workspaceId,
          pageId: pageRow.id,
          title: "Elevated latency",
          status: "investigating",
        })
        .returning()
        .get();
      await tx.insert(statusReportsToPageComponents).values({
        statusReportId: report.id,
        pageComponentId: monitorComponent.id,
      });
      const update = await tx
        .insert(statusReportUpdate)
        .values({
          statusReportId: report.id,
          status: "investigating",
          date: now,
          message: "looking into it",
        })
        .returning()
        .get();
      await tx.insert(statusReportUpdateToPageComponents).values({
        statusReportUpdateId: update.id,
        pageComponentId: monitorComponent.id,
        impact: "degraded_performance",
      });

      const today = new Date(
        Math.floor(now.getTime() / 86_400_000) * 86_400_000,
      ).toISOString();
      const fakeTb = {
        httpStatus45d: ({ monitorIds }: { monitorIds: string[] }) => {
          expect(monitorIds).toEqual([String(mon.id)]);
          return Promise.resolve({
            data: [
              {
                day: today,
                count: 10,
                ok: 9,
                degraded: 1,
                error: 0,
                monitorId: String(mon.id),
              },
            ],
          });
        },
        tcpStatus45d: () => Promise.resolve({ data: [] }),
        dnsStatus45d: () => Promise.resolve({ data: [] }),
      } as unknown as NonNullable<ServiceContext["tb"]>;

      const { components } = await getPageComponentDailySummary({
        ctx: { ...teamCtx, db: tx, tb: fakeTb },
        input: { pageId: pageRow.id, workspaceId, days: 3 },
      });

      expect(components.map((c) => c.componentId)).toEqual([
        monitorComponent.id,
        staticComponent.id,
      ]);

      const monitorSummary = components[0];
      expect(monitorSummary.type).toBe("monitor");
      expect(monitorSummary.monitorId).toBe(mon.id);
      // gap-filled to the requested window
      expect(monitorSummary.buckets).toHaveLength(3);

      const todayBucket = monitorSummary.buckets.find((b) => b.day === today);
      expect(todayBucket).toBeDefined();
      expect(todayBucket?.count).toBe(10);
      // a degraded report overlaps today → resolved status + impact
      expect(todayBucket?.status).toBe("degraded");
      expect(todayBucket?.impact).toBe("degraded_performance");

      // days without data or events are empty
      expect(
        monitorSummary.buckets.filter((b) => b.status === "empty"),
      ).toHaveLength(2);

      // maintenance + report surface as events, with report impact tagged
      expect(monitorSummary.events.map((e) => e.type).sort()).toEqual([
        "maintenance",
        "report",
      ]);
      const reportEvent = monitorSummary.events.find(
        (e) => e.type === "report",
      );
      expect(reportEvent?.impact).toBe("degraded_performance");

      const staticSummary = components[1];
      expect(staticSummary.type).toBe("static");
      expect(staticSummary.monitorId).toBeUndefined();
      expect(staticSummary.buckets).toHaveLength(3);
      // events are scoped to the monitor component, not the static one
      expect(staticSummary.events).toHaveLength(0);
      expect(staticSummary.buckets.every((b) => b.status === "empty")).toBe(
        true,
      );
    });
  });

  test("filters to requested componentIds and rejects unknown ones", async () => {
    await withTestTransaction(async (tx) => {
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId,
          title: `${TEST_PREFIX}-filter-page`,
          description: "test",
          slug: `${TEST_PREFIX}-filter-${Date.now()}`,
          customDomain: "",
        })
        .returning()
        .get();

      const compA = await tx
        .insert(pageComponent)
        .values({
          workspaceId,
          pageId: pageRow.id,
          type: "static",
          name: "A",
          order: 0,
        })
        .returning()
        .get();
      await tx
        .insert(pageComponent)
        .values({
          workspaceId,
          pageId: pageRow.id,
          type: "static",
          name: "B",
          order: 1,
        })
        .returning()
        .get();

      // static-only page → no monitor ids → fetchMonitorDailyStats never calls a pipe
      const emptyTb = {
        httpStatus45d: () => Promise.resolve({ data: [] }),
        tcpStatus45d: () => Promise.resolve({ data: [] }),
        dnsStatus45d: () => Promise.resolve({ data: [] }),
      } as unknown as NonNullable<ServiceContext["tb"]>;

      const { components } = await getPageComponentDailySummary({
        ctx: { ...teamCtx, db: tx, tb: emptyTb },
        input: {
          pageId: pageRow.id,
          workspaceId,
          componentIds: [compA.id],
          days: 2,
        },
      });
      expect(components.map((c) => c.componentId)).toEqual([compA.id]);

      await expect(
        getPageComponentDailySummary({
          ctx: { ...teamCtx, db: tx, tb: emptyTb },
          input: {
            pageId: pageRow.id,
            workspaceId,
            componentIds: [compA.id, 999_999_999],
            days: 2,
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
