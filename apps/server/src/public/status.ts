import { Hono } from "hono";

import { db, eq } from "@openstatus/db";
import { monitor, monitorsToPages, page } from "@openstatus/db/src/schema";
import { getMonitorList, Tinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

// TODO: include ratelimiting

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });
const redis = Redis.fromEnv();

enum Status {
  Operational = "operational",
  DegradedPerformance = "degraded_performance",
  PartialOutage = "partial_outage",
  MajorOutage = "major_outage",
  UnderMaintenance = "under_maintenance",
  Unknown = "unknown",
}

export const status = new Hono();

status.get("/:slug", async (c) => {
  const { slug } = c.req.param();

  const cache = await redis.get(slug);
  if (cache) return c.json({ status: cache });

  // { monitors, pages, monitors_to_pages }
  const monitorData = await db
    .select()
    .from(monitorsToPages)
    .leftJoin(monitor, eq(monitorsToPages.monitorId, monitor.id))
    .leftJoin(page, eq(monitorsToPages.pageId, page.id))
    .where(eq(page.slug, slug))
    .all();

  // { data: [{ ok, count }] }
  const lastMonitorPings = await Promise.allSettled(
    monitorData.map(async ({ monitors_to_pages }) => {
      return await getMonitorList(tb)({
        monitorId: String(monitors_to_pages.monitorId),
        limit: 5, // limits the grouped cronTimestamps
      });
    }),
  );

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

  const status = getStatus(ratio);
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
