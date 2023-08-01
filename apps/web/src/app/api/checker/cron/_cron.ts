// import { Client } from "@upstash/qstash/cloudflare";
import type { z } from "zod";

import { and, db, eq } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { availableRegions } from "@openstatus/tinybird";

import { env } from "@/env";
import { DEFAULT_URL } from "../_shared";
import type { payloadSchema } from "../schema";

const periodicityAvailable = selectMonitorSchema.pick({ periodicity: true });

export const cron = async ({
  periodicity,
}: z.infer<typeof periodicityAvailable>) => {
  // const c = new Client({
  //   token: env.QSTASH_TOKEN,
  // });

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
      try {
        const result = fetch(`${DEFAULT_URL}/api/checker/regions/${region}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        allResult.push(result);
      } catch (e) {
        console.error(e);
        const result = fetch(`${DEFAULT_URL}/api/checker/regions/${region}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        allResult.push(result);
      }
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

      try {
        const result = fetch(`${DEFAULT_URL}/api/checker/regions/${region}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        allResult.push(result);
      } catch (e) {
        console.error(e);
        const result = fetch(`${DEFAULT_URL}/api/checker/regions/${region}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        allResult.push(result);
      }
    }
  }
  await Promise.all(allResult);
};
