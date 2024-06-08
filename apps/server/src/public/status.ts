import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { and, db, eq, inArray, isNull } from "@openstatus/db";
import {
  incidentTable,
  monitor,
  monitorsToPages,
  monitorsToStatusReport,
  page,
  pagesToStatusReports,
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

  const { pageStatusReportData, monitorStatusReportData, ongoingIncidents } =
    await getStatusPageData(currentPage.id);
  endTime(c, "database");

  const statusReports = [
    ...pageStatusReportData,
    ...monitorStatusReportData,
  ].map((item) => {
    return item.status_report;
  });

  // TODO: add maintenances
  const tracker = new Tracker({ incidents: ongoingIncidents, statusReports });

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

  const monitorStatusReportQuery = db
    .select()
    .from(monitorsToStatusReport)
    .innerJoin(
      statusReport,
      eq(monitorsToStatusReport.statusReportId, statusReport.id)
    )
    .where(inArray(monitorsToStatusReport.monitorId, monitorIds))
    .all();

  const pageStatusReportDataQuery = db
    .select()
    .from(pagesToStatusReports)
    .innerJoin(
      statusReport,
      and(
        eq(pagesToStatusReports.statusReportId, statusReport.id),
        eq(pagesToStatusReports.pageId, pageId)
      )
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

  // TODO: query ongoingMaintenancesQuery

  const [monitorStatusReportData, pageStatusReportData, ongoingIncidents] =
    await Promise.all([
      monitorStatusReportQuery,
      pageStatusReportDataQuery,
      ongoingIncidentsQuery,
    ]);

  return {
    // monitorData,
    pageStatusReportData,
    monitorStatusReportData,
    ongoingIncidents,
  };
}
