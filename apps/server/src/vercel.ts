import type { Context, Env } from "hono";

import { Tinybird } from "@openstatus/tinybird";

import { logDrainSchema, logDrainSchemaArray } from "./schema/vercel";

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" }); // should we use t3-env?

export function publishVercelLogDrain() {
  return tb.buildIngestEndpoint({
    datasource: "vercel_log_drain__v0",
    event: logDrainSchema,
  });
}

export const VercelIngest = async (
  c: Context<Env, "/integration/vercel", {}>,
) => {
  const json = c.req.json();
  const logDrains = logDrainSchemaArray.safeParse(json);

  if (logDrains.success) {
    // We are only pushing the logs that are not stdout or stderr
    const data = logDrains.data.filter(
      (log) => log.type !== "stdout" && log.type !== "stderr",
    );

    for (const event of data) {
      // FIXME: Zod-bird is broken
      await publishVercelLogDrain()(event);
    }
  }

  c.json({ code: "ok" });
};
