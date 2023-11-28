import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  monitorsToStatusReport,
  page,
  pagesToStatusReports,
  statusReport,
} from "@openstatus/db/src/schema";
import { getMonitorList, Tinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

import { env } from "../env";

// TODO: include ratelimiting

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });
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
  // { monitors, pages, monitors_to_pages }
  const monitorData = await db
    .select()
    .from(monitorsToPages)
    .leftJoin(monitor, eq(monitorsToPages.monitorId, monitor.id))
    .leftJoin(
      monitorsToStatusReport,
      eq(monitor.id, monitorsToStatusReport.monitorId),
    )
    .leftJoin(
      statusReport,
      eq(monitorsToStatusReport.statusReportId, statusReport.id),
    )
    .leftJoin(page, eq(monitorsToPages.pageId, page.id))
    .where(eq(page.slug, slug))
    .all();

  const pageIncidentData = await db
    .select()
    .from(pagesToStatusReports)
    .leftJoin(incident, eq(pagesToStatusReports.statusReportId, incident.id))
    .leftJoin(page, eq(pagesToStatusReports.pageId, page.id))
    .where(eq(page.slug, slug))
    .all();

  endTime(c, "database");

  const isIncident = [...pageIncidentData, ...monitorData].some((data) => {
    if (!data.status_report) return false;
    return !["monitoring", "resolved"].includes(data.status_report.status);
  });

  startTime(c, "clickhouse");
  // { data: [{ ok, count }] }
  const lastMonitorPings = await Promise.allSettled(
    monitorData.map(async ({ monitors_to_pages }) => {
      return await getMonitorList(tb)({
        monitorId: String(monitors_to_pages.monitorId),
        limit: 5, // limits the grouped cronTimestamps
      });
    }),
  );
  endTime(c, "clickhouse");
  // { ok, count }
  const data = lastMonitorPings.reduce(
    (prev, curr) => {
      if (curr.status === "fulfilled") {
        const { ok, count } = curr.value.data.reduce(
          (p, c) => {
            p.ok += c.ok;
            p.count += c.count;
            return p;
          },
          { ok: 0, count: 0 },
        );
        prev.ok += ok;
        prev.count += count;
      }
      return prev;
    },
    { ok: 0, count: 0 },
  );

  const ratio = data.ok / data.count;

  const status: Status = isIncident ? Status.Incident : getStatus(ratio);

  await redis.set(slug, status, { ex: 30 });

  return c.json({ status });
});

function getStatus(ratio: number) {
  if (isNaN(ratio)) return Status.Unknown;
  if (ratio >= 0.98) return Status.Operational;
  if (ratio >= 0.6) return Status.DegradedPerformance;
  if (ratio >= 0.3) return Status.PartialOutage;
  if (ratio >= 0) return Status.MajorOutage;
  return Status.Unknown;
}
