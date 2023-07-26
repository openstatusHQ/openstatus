import { Client } from "@upstash/qstash/cloudflare";
import type { z } from "zod";

import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { availableRegions } from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import type { payloadSchema } from "../schema";

const periodicityAvailable = selectMonitorSchema.pick({ periodicity: true });

const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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
    .where(eq(monitor.periodicity, periodicity))
    .all();

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
        pageId: allPages.map((p) => String(p.pageId)),
      };

      await c.publishJSON({
        url: `${DEFAULT_URL}/api/checker/region/${region}`,
        body: payload,
      });
    }
  }
  if (periodicity === "10m") {
    // Right now we are just checking the ping endpoint
    for (const region of availableRegions) {
      const payload: z.infer<typeof payloadSchema> = {
        workspaceId: "openstatus",
        monitorId: "openstatusPing",
        url: `${DEFAULT_URL}/api/ping`,
        cronTimestamp: timestamp,
        pageId: ["openstatus"],
      };

      await c.publishJSON({
        url: `${DEFAULT_URL}/api/checker/regions/${region}`,
        body: {
          url: `${DEFAULT_URL}/api/ping`,
          // FIXME: what is the concret timezone format? In DE, is 02h later
          cronTimestamp: timestamp, // used to group all region requests - can be also cronId
        },
      });
    }
  }
};
