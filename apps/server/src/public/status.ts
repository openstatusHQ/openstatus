import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { and, db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  monitorsToStatusReport,
  page,
  pagesToStatusReports,
  statusReport,
} from "@openstatus/db/src/schema";
import { getPublicStatus, Tinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

import { env } from "../env";
import { notEmpty } from "../utils/not-empty";

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
  const { monitorData, pageStatusReportData, monitorStatusReportData } =
    await getStatusPageData(slug);
  endTime(c, "database");

  const isIncident = [...pageStatusReportData, ...monitorStatusReportData].some(
    (data) => {
      if (!data.status_report) return false;
      return !["monitoring", "resolved"].includes(data.status_report.status);
    },
  );

  startTime(c, "clickhouse");
  const lastMonitorPings = await Promise.allSettled(
    monitorData.map(async ({ monitors_to_pages }) => {
      return await getPublicStatus(tb)({
        monitorId: String(monitors_to_pages.monitorId),
      });
    }),
  );
  endTime(c, "clickhouse");

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

  await redis.set(slug, status, { ex: 60 }); // 1m cache

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

  const monitorStatusReportData = await db
    .select()
    .from(monitorsToStatusReport)
    .leftJoin(
      statusReport,
      eq(monitorsToStatusReport.statusReportId, statusReport.id),
    )
    .where(inArray(monitorsToStatusReport.monitorId, monitorIds))
    .all();

  // REMINDER: the query can overlap with the previous one
  const pageStatusReportData = await db
    .select()
    .from(pagesToStatusReports)
    .leftJoin(
      statusReport,
      eq(pagesToStatusReports.statusReportId, statusReport.id),
    )
    .leftJoin(page, eq(pagesToStatusReports.pageId, page.id))
    .where(eq(page.slug, slug))
    .all();

  return {
    monitorData,
    pageStatusReportData,
    monitorStatusReportData,
  };
}
