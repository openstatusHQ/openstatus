import { Client } from "@upstash/qstash/nodejs";
import type { z } from "zod";

import { db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";

import { env } from "@/env.mjs";
import { availableRegions } from "../regions/_checker";

const frequencyAvailable = selectMonitorSchema.pick({ frequency: true });

export const runtime = "edge";

const DEFAULT_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://openstatus.dev";

export const cron = async ({
  frequency,
}: z.infer<typeof frequencyAvailable>) => {
  const c = new Client({
    token: env.QSTASH_TOKEN,
  });

  const result = await db
    .select()
    .from(monitor)
    .where(eq(monitor.frequency, frequency));

  for (const row of result) {
    for (const region of availableRegions) {
      await c.publishJSON({
        url: `${DEFAULT_URL}/api/checker/region/${region}`,
        body: {
          url: row.url,
        },
      });
    }
  }
};
