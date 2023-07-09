import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash/cloudflare";
import type { z } from "zod";

import { db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";
import { availableRegions } from "@openstatus/tinybird";

import { env } from "@/env.mjs";

const frequencyAvailable = selectMonitorSchema.pick({ frequency: true });

const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const cron = async ({
  frequency,
}: z.infer<typeof frequencyAvailable>) => {
  const c = new Client({
    token: env.QSTASH_TOKEN,
  });

  const timestamp = Date.now();
  // FIXME: Wait until db is ready
  // const result = await db
  //   .select()
  //   .from(monitor)
  //   .where(eq(monitor.frequency, frequency));

  // for (const row of result) {
  //   for (const region of availableRegions) {
  //     await c.publishJSON({
  //       url: `${DEFAULT_URL}/api/checker/region/${region}`,
  //       body: {
  //         url: row.url,
  //         cronTimestamp: timestamp, // used to group all region requests
  //       },
  //     });
  //   }
  // }

  // Right now we are just checking the ping endpoint
  for (const region of availableRegions) {
    await c.publishJSON({
      url: `${DEFAULT_URL}/api/checker/regions/${region}`,
      body: {
        url: `${DEFAULT_URL}/api/ping`,
        // FIXME: what is the concret timezone format? In DE, is 02h later
        cronTimestamp: timestamp, // used to group all region requests - can be also cronId
      },
    });
  }
};
