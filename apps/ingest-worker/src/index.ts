import { browserName, detectOS } from "detect-browser";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";
import { tbIngestWebVitals } from "@openstatus/tinybird/src/validation";

import { getDevice } from "./utils";

type Bindings = {
  API_ENDPOINT: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
  TINYBIRD_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const schema = z.object({
  dsn: z.string(),
  name: z.string(),
  href: z.string(),
  id: z.string(),
  speed: z.string(),
  path: z.string(),
  rating: z.string().optional(),
  value: z.number(),
  screen: z.string(),
  session_id: z.string(),
});

const schemaV1 = z.object({
  event_type: z.literal("web-vitals"),
  dsn: z.string(),
  href: z.string(),
  speed: z.string(),
  path: z.string(),
  screen: z.string(),
  data: z.object({
    name: z.string(),
    rating: z.string().optional(),
    value: z.number(),
    id: z.string(),
  }),
  session_id: z.string(),
});

const cfSchema = schema.extend({
  browser: z.string().default(""),
  city: z.string().default(""),
  country: z.string().default(""),
  continent: z.string().default(""),
  device: z.string().default(""),
  region_code: z.string().default(""),
  timezone: z.string().default(""),
  os: z.string(),
  path: z.string(),
  screen: z.string(),
  event_name: z.string(),
});

app.get("/", (c) => {
  return c.text("Hello OpenStatus!");
});

app.post("/", async (c) => {
  const rawText = await c.req.text();
  const data = z.array(schema).parse(JSON.parse(rawText));
  const userAgent = c.req.header("user-agent") || "";

  const country = c.req.header("cf-ipcountry") || "";
  const city = c.req.raw.cf?.city || "";
  const region_code = c.req.raw.cf?.regionCode || "";
  const timezone = c.req.raw.cf?.timezone || "";
  const browser = browserName(userAgent) || "";
  const continent = c.req.raw.cf?.continent || "";

  const os = detectOS(userAgent) || "";
  const payload = data.map((d) => {
    return cfSchema.parse({
      ...d,
      event_name: d.name,
      browser,
      country,
      city,
      timezone,
      region_code,
      continent,
      os,
    });
  });

  const insert = async () => {
    const res = [];
    for (const p of payload) {
      const { API_ENDPOINT } = env(c);

      const r = fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(p),
      });

      res.push(r);
    }
    await Promise.allSettled(res);
    // console.log(pro);
    console.log("Inserted");
  };
  c.executionCtx.waitUntil(insert());
  return c.json({ status: "ok" }, 200);
});

app.post("/v1", async (c) => {
  const rawText = await c.req.text();
  const data = z.array(schemaV1).parse(JSON.parse(rawText));
  const userAgent = c.req.header("user-agent") || "";

  const timestamp = Date.now();
  const country = c.req.header("cf-ipcountry") || "";
  const city = c.req.raw.cf?.city || "";
  const region_code = c.req.raw.cf?.regionCode || "";
  const timezone = c.req.raw.cf?.timezone || "";
  const browser = browserName(userAgent) || "";
  const continent = c.req.raw.cf?.continent || "";
  const os = detectOS(userAgent) || "";
  const payload = data.map((d) => {
    const device = getDevice(d.screen, os);
    return tbIngestWebVitals.parse({
      ...d,
      timestamp,
      device,
      ...d.data,
      browser,
      country,
      city,
      timezone,
      region_code,
      continent,
      os,
    });
  });

  const { TINYBIRD_TOKEN } = env(c);
  // const client = buildLibsqlClient({
  //   url: DATABASE_URL,
  //   token: DATABASE_AUTH_TOKEN,
  // });

  // const db = createDb({ client });
  const tb = new OSTinybird({ token: TINYBIRD_TOKEN });
  const insert = async () => {
    // console.log(payload);

    // We only take the first payload but we should take all
    // // Fetch db
    // const r = await db
    //   .select()
    //   .from(application)
    //   .where(eq(application.dsn, payload[0].dsn))
    //   .get();
    // if (!r) {
    //   return;
    // }

    // Ingest In TB
    await tb.ingestWebVitals(payload);
    console.log("Inserted");
  };

  c.executionCtx.waitUntil(insert());
  return c.json({ status: "ok" }, 200);
});

export default app;
