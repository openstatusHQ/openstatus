import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorIncidentTable,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
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
  const team = (await createWorkspaceFixture("team")).workspace;
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

  test("keeps only events inside the window, plus unresolved reports of any age", async () => {
    await withTestTransaction(async (tx) => {
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId,
          title: `${TEST_PREFIX}-window-page`,
          description: "test",
          slug: `${TEST_PREFIX}-window-${Date.now()}`,
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
          name: `${TEST_PREFIX}-window-monitor`,
          method: "GET",
          jobType: "http",
          periodicity: "10m",
          regions: "ams",
        })
        .returning()
        .get();

      const component = await tx
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

      const day = 86_400_000;
      const now = Date.now();
      const old = (n: number) => new Date(now - n * day);

      const addMaintenance = async (title: string, from: Date, to: Date) => {
        const row = await tx
          .insert(maintenance)
          .values({
            workspaceId,
            pageId: pageRow.id,
            title,
            message: title,
            from,
            to,
          })
          .returning()
          .get();
        await tx.insert(maintenancesToPageComponents).values({
          maintenanceId: row.id,
          pageComponentId: component.id,
        });
      };
      await addMaintenance("old maintenance", old(30), old(29));
      await addMaintenance("recent maintenance", old(2), old(1));

      const addReport = async (
        title: string,
        status: "investigating" | "resolved",
        dates: Date[],
      ) => {
        const row = await tx
          .insert(statusReport)
          .values({ workspaceId, pageId: pageRow.id, title, status })
          .returning()
          .get();
        await tx.insert(statusReportsToPageComponents).values({
          statusReportId: row.id,
          pageComponentId: component.id,
        });
        for (const [i, date] of dates.entries()) {
          await tx.insert(statusReportUpdate).values({
            statusReportId: row.id,
            status: i === dates.length - 1 ? status : "investigating",
            date,
            message: title,
          });
        }
      };
      await addReport("old resolved report", "resolved", [old(30), old(29)]);
      await addReport("old unresolved report", "investigating", [old(30)]);
      // started before the window, resolved inside it
      await addReport("spanning report", "resolved", [old(30), old(2)]);

      const incidents = await tx
        .insert(monitorIncidentTable)
        .values([
          {
            workspaceId,
            monitorId: mon.id,
            startedAt: old(31),
            resolvedAt: old(29),
          },
          { workspaceId, monitorId: mon.id, startedAt: old(30) },
          {
            workspaceId,
            monitorId: mon.id,
            startedAt: old(3),
            resolvedAt: old(1),
          },
          {
            workspaceId,
            monitorId: mon.id,
            startedAt: old(2),
            resolvedAt: old(1),
            excusedAt: old(1),
          },
        ])
        .returning()
        .all();

      const emptyTb = {
        httpStatus45d: () => Promise.resolve({ data: [] }),
      } as unknown as NonNullable<ServiceContext["tb"]>;

      const { components } = await getPageComponentDailySummary({
        ctx: { ...teamCtx, db: tx, tb: emptyTb },
        input: { pageId: pageRow.id, workspaceId, days: 7 },
      });

      const events = components[0].events;
      expect(
        events
          .filter((e) => e.type !== "incident")
          .map((e) => e.name)
          .sort(),
      ).toEqual([
        "old unresolved report",
        "recent maintenance",
        "spanning report",
      ]);
      expect(
        events
          .filter((e) => e.type === "incident")
          .map((e) => e.id)
          .sort((a, b) => a - b),
      ).toEqual([incidents[1].id, incidents[2].id].sort((a, b) => a - b));
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
