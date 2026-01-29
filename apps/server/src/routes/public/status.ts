import { getLogger } from "@logtape/logtape";
import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

const logger = getLogger("api-server");
import { Status, Tracker } from "@openstatus/tracker";

import { redis } from "@/libs/clients";

// TODO: include ratelimiting

export const status = new Hono();

status.get("/:slug", async (c) => {
  try {
    const { slug } = c.req.param();

    const cache = await redis.get(slug);

    if (cache) {
      setMetric(c, "OpenStatus-Cache", "HIT");
      return c.json({ status: cache });
    }

    startTime(c, "database");

    // Single query with all relations
    const currentPage = await db.query.page.findFirst({
      where: eq(page.slug, slug),
      with: {
        pageComponents: {
          with: {
            monitor: {
              with: {
                incidents: true,
              },
            },
          },
        },
        statusReports: true,
        maintenances: true,
      },
    });

    endTime(c, "database");

    if (!currentPage) {
      return c.json({ status: Status.Unknown });
    }

    if (currentPage.accessType !== "public") {
      return c.json({ status: Status.Unknown });
    }

    // Extract active monitor components
    const monitorComponents = currentPage.pageComponents.filter(
      (c) =>
        c.type === "monitor" &&
        c.monitor &&
        c.monitor.active &&
        !c.monitor.deletedAt,
    );

    // Extract all ongoing incidents from active monitors
    const ongoingIncidents = monitorComponents.flatMap(
      (c) => c.monitor?.incidents?.filter((inc) => !inc.resolvedAt) ?? [],
    );

    // Filter for unresolved status reports
    const unresolvedStatusReports = currentPage.statusReports.filter(
      (report) => report.status !== "resolved",
    );

    // Filter for ongoing maintenances
    const now = new Date();
    const ongoingMaintenances = currentPage.maintenances.filter(
      (m) => m.from <= now && m.to >= now,
    );

    // Use the tracker to determine status
    const tracker = new Tracker({
      incidents: ongoingIncidents,
      statusReports: unresolvedStatusReports,
      maintenances: ongoingMaintenances,
    });

    const status = tracker.currentStatus;
    await redis.set(slug, status, { ex: 60 }); // 1m cache

    return c.json({ status });
  } catch (e) {
    logger.error("Error in public status page", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return c.json({ status: Status.Unknown });
  }
});
