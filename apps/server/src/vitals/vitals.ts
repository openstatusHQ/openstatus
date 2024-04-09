import { z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { clickhouseClient, db, eq, schema } from "@openstatus/db";

// Not sure if we should make this public or not
const vitalsSchema = z.object({
  dsn: z.string(),
  event_name: z.string(),
  href: z.string(),
  id: z.string(),
  language: z.string().optional(),
  os: z.string().optional(),
  page: z.string().optional(),
  screen: z.string().optional(),
  speed: z.string(),
  value: z.number(),
  browser: z.string(),
  city: z.string(),
  country: z.string(),
  continent: z.string(),
  device: z.string(),
  region_code: z.string(),
  timezone: z.string(),
});

const vitalsAPI = new Hono<{}>();

vitalsAPI.post("/", zValidator("json", vitalsSchema), async (c) => {
  const data = c.req.valid("json");
  console.log(data);
  const currentWorkspace = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.dsn, data.dsn))
    .run();
  if (!currentWorkspace) {
    return c.text("Workspace not found", 404);
  }

  const t = await clickhouseClient.ping();
  console.log(t);
  await clickhouseClient.insert({
    table: "cwv",
    values: [{ event_date: new Date(), ...data }],
  });
  return c.text("OK");
});

export { vitalsAPI };
