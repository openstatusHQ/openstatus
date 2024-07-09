import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { and, db, eq, gte, inArray, isNull, lte, ne } from "@openstatus/db";
import {
  incidentTable,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  statusReport,
} from "@openstatus/db/src/schema";
import { Status, Tracker } from "@openstatus/tracker";
import { Redis } from "@openstatus/upstash";

import { notEmpty } from "../utils/not-empty";

// TODO: include ratelimiting

const redis = Redis.fromEnv();

export const status = new Hono();

status.get("/:slug", async (c) => {
  const { slug } = c.req.param();

  const cache = await redis.get(slug);

  if (cache) {
    setMetric(c, "OpenStatus-Cache", "HIT");
    return c.json({ status: cache });
  }

  startTime(c, "database");

  const currentPage = await db
    .select()
    .from(page)
    .where(eq(page.slug, slug))
    .get();

  if (!currentPage) {
    return c.json({ status: Status.Unknown });
  }

  const {
    pageStatusReportData,

    ongoingIncidents,
    maintenanceData,
  } = await getStatusPageData(currentPage.id);
  endTime(c, "database");

  console.log(maintenanceData);

  const statusReports = [...pageStatusReportData].map((item) => {
    return item;
  });

  const tracker = new Tracker({
    incidents: ongoingIncidents,
    statusReports,
    maintenances: maintenanceData,
  });

  const status = tracker.currentStatus;
  await redis.set(slug, status, { ex: 60 }); // 1m cache

  return c.json({ status });
});

async function getStatusPageData(pageId: number) {
  const monitorData = await db
    .select()
    .from(monitorsToPages)
    .innerJoin(
      monitor,
      // REMINDER: query only active monitors as they are the ones that are displayed on the status page
      and(
        eq(monitorsToPages.monitorId, monitor.id),
        eq(monitor.active, true),
        eq(monitorsToPages.pageId, pageId)
      )
    )

    .all();

  const monitorIds = monitorData.map((i) => i.monitor?.id).filter(notEmpty);
  if (monitorIds.length === 0) {
    return {
      monitorData,
      pageStatusReportData: [],
      monitorStatusReportData: [],
      ongoingIncidents: [],
    };
  }

  const pageStatusReportDataQuery = db
    .select()
    .from(statusReport)
    .where(
      and(eq(statusReport.pageId, pageId), ne(statusReport.status, "resolved"))
    )
    .all();

  const ongoingIncidentsQuery = db
    .select()
    .from(incidentTable)
    .where(
      and(
        isNull(incidentTable.resolvedAt),
        inArray(incidentTable.monitorId, monitorIds)
      )
    )
    .all();

  const ongoingMaintenancesQuery = db
    .select()
    .from(maintenance)
    .where(
      and(
        eq(maintenance.pageId, pageId),
        lte(maintenance.from, new Date()),
        gte(maintenance.to, new Date())
      )
    );

  const [pageStatusReportData, ongoingIncidents, maintenanceData] =
    await Promise.all([
      pageStatusReportDataQuery,
      ongoingIncidentsQuery,
      ongoingMaintenancesQuery,
    ]);

  return {
    // monitorData,
    pageStatusReportData,
    maintenanceData,
    ongoingIncidents,
  };
}
