import { getLogger } from "@logtape/logtape";
import { Status, currentStatus } from "@openstatus/services/status-page";
import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

import { redis } from "../../libs/clients";

const logger = getLogger("api-server");

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
    const status = await currentStatus({ ctx: {}, input: { slug } });
    endTime(c, "database");

    // missing / non-public pages stay uncached so a newly published page is
    // visible immediately rather than after the TTL
    if (status !== Status.Unknown) {
      await redis.set(slug, status, { ex: 60 }); // 1m cache
    }

    return c.json({ status });
  } catch (e) {
    logger.error("Error in public status page", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return c.json({ status: Status.Unknown });
  }
});
