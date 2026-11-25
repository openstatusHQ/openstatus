import { getLogger } from "@logtape/logtape";
import { getPublicPageStatusInputs } from "@openstatus/services/public-status-page";
import { Hono } from "hono";
import { endTime, setMetric, startTime } from "hono/timing";

const logger = getLogger("api-server");
import { Status, Tracker } from "@openstatus/tracker";

import { cacheKeys } from "../../libs/cache-keys";
import { redis } from "../../libs/clients";

// TODO: include ratelimiting

export const status = new Hono();

status.get("/:slug", async (c) => {
  try {
    const { slug } = c.req.param();

    // Only public pages are ever written under this prefix, so a hit needs no
    // access check; a page made private can stay cached for up to the 60s TTL.
    const cache = await redis.get(cacheKeys.pageStatus(slug));

    if (cache) {
      setMetric(c, "OpenStatus-Cache", "HIT");
      return c.json({ status: cache });
    }

    startTime(c, "database");

    const inputs = await getPublicPageStatusInputs({ slug });

    endTime(c, "database");

    if (!inputs) {
      return c.json({ status: Status.Unknown });
    }

    const tracker = new Tracker(inputs);

    const status = tracker.currentStatus;
    await redis.set(cacheKeys.pageStatus(slug), status, { ex: 60 }); // 1m cache

    return c.json({ status });
  } catch (e) {
    logger.error("Error in public status page", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return c.json({ status: Status.Unknown });
  }
});
