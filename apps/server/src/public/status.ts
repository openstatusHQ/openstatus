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
import { Redis } from "@openstatus/upstash";

import { notEmpty } from "../utils/not-empty";

// TODO: include ratelimiting

const redis = Redis.fromEnv();

enum Status {
  Operational = "operational",
  DegradedPerformance = "degraded_performance",
  PartialOutage = "partial_outage",
  MajorOutage = "major_outage",
  UnderMaintenance = "under_maintenance",
  Unknown = "unknown",
  Incident = "incident",
}

export const status = new Hono();

status.get("/:slug", async (c) => {
  const { slug } = c.req.param();

  const cache = await redis.get(slug);

  if (cache) {
    setMetric(c, "OpenStatus-Cache", "HIT");
    return c.json({ status: cache });
  }

  startTime(c, "database");
  const {
    monitorData,
    pageStatusReportData,
    monitorStatusReportData,
    ongoingIncidents,
  } = await getStatusPageData(slug);
  endTime(c, "database");

  if (monitorData.length === 0) {
    await redis.set(slug, Status.Unknown, { ex: 60 }); // 1m cache
    return c.json({ status: Status.Unknown });
  }
  const isIncident = [...pageStatusReportData, ...monitorStatusReportData].some(
    (data) => {
      if (!data.status_report) return false;
      return !["monitoring", "resolved"].includes(data.status_report.status);
    },
  );

  if (isIncident) {
    await redis.set(slug, Status.Incident, { ex: 60 }); // 1m cache
    return c.json({ status: Status.Incident });
  }

  // we should  add the degradation of performance to the checker
  // e.g. if the monitor performance is above a certain threshold
  if (ongoingIncidents.length > 0) {
    await redis.set(slug, Status.Incident, { ex: 60 }); // 1m cache
    return c.json({ status: Status.Incident });
  }

  const status = Status.Operational;
  await redis.set(slug, status, { ex: 60 }); // 1m cache

  return c.json({ status });
});

async function getStatusPageData(slug: string) {
  const monitorData = await db
    .select()
    .from(monitorsToPages)
    .leftJoin(
      monitor,
      // REMINDER: query only active monitors as they are the ones that are displayed on the status page
      and(eq(monitorsToPages.monitorId, monitor.id), eq(monitor.active, true)),
    )
    .leftJoin(page, eq(monitorsToPages.pageId, page.id))
    .where(eq(page.slug, slug))
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
    .leftJoin(
      statusReport,
      eq(monitorsToStatusReport.statusReportId, statusReport.id),
    )
    .where(inArray(monitorsToStatusReport.monitorId, monitorIds))
    .all();

  // REMINDER: the query can overlap with the previous one
  const pageStatusReportDataQuery = db
    .select()
    .from(pagesToStatusReports)
    .leftJoin(
      statusReport,
      eq(pagesToStatusReports.statusReportId, statusReport.id),
    )
    .leftJoin(page, eq(pagesToStatusReports.pageId, page.id))
    .where(eq(page.slug, slug))
    .all();

  const ongoingIncidentsQuery = db
    .select()
    .from(incidentTable)
    .where(
      and(
        isNull(incidentTable.resolvedAt),
        inArray(incidentTable.monitorId, monitorIds),
      ),
    )
    .all();
  const [monitorStatusReportData, pageStatusReportData, ongoingIncidents] =
    await Promise.all([
      monitorStatusReportQuery,
      pageStatusReportDataQuery,
      ongoingIncidentsQuery,
    ]);

  return {
    monitorData,
    pageStatusReportData,
    monitorStatusReportData,
    ongoingIncidents,
  };
}
