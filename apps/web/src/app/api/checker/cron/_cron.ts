import { Client } from "@upstash/qstash/cloudflare";
import type { z } from "zod";

import { and, db, eq } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { availableRegions } from "@openstatus/tinybird";

import { env } from "@/env";
import type { payloadSchema } from "../schema";

const periodicityAvailable = selectMonitorSchema.pick({ periodicity: true });

const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

// We can't secure cron endpoint by vercel thus we should make sure they are called by the generated url
export const isAuthorizedDomain = (url: string) => {
  return url.includes(DEFAULT_URL);
};

export const cron = async ({
  periodicity,
}: z.infer<typeof periodicityAvailable>) => {
  const c = new Client({
    token: env.QSTASH_TOKEN,
  });

  const timestamp = Date.now();
  // FIXME: Wait until db is ready
  const result = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.periodicity, periodicity), eq(monitor.active, true)))
    .all();

  const allResult = [];

  for (const row of result) {
    // could be improved with a single query
    const allPages = await db
      .select()
      .from(monitorsToPages)
      .where(eq(monitorsToPages.monitorId, row.id))
      .all();

    for (const region of availableRegions) {
      const payload: z.infer<typeof payloadSchema> = {
        workspaceId: String(row.workspaceId),
        monitorId: String(row.id),
        url: row.url,
        cronTimestamp: timestamp,
        pageIds: allPages.map((p) => String(p.pageId)),
      };

      const result = c.publishJSON({
        url: `${DEFAULT_URL}/api/checker/regions/${region}`,
        body: payload,
      });
      allResult.push(result);
    }
  }
  // our first legacy monitor
  if (periodicity === "10m") {
    // Right now we are just checking the ping endpoint
    for (const region of availableRegions) {
      const payload: z.infer<typeof payloadSchema> = {
        workspaceId: "openstatus",
        monitorId: "openstatusPing",
        url: `${DEFAULT_URL}/api/ping`,
        cronTimestamp: timestamp,
        pageIds: ["openstatus"],
      };

      const result = c.publishJSON({
        url: `${DEFAULT_URL}/api/checker/regions/${region}`,
        body: payload,
      });
      allResult.push(result);
    }
  }
  await Promise.all(allResult);
};
