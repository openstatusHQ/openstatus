import { zValidator } from "@hono/zod-validator";
import { browserName, detectOS } from "detect-browser";
import { Hono } from "hono";
import { z } from "zod";

type Bindings = {
  API_ENDPOINT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const schema = z.object({
  dsn: z.string(),
  event_name: z.string(),
  href: z.string(),
  id: z.string(),
  speed: z.string(),
  path: z.string(),
  value: z.number(),
});

const chSchema = schema.extend({
  browser: z.string().default(""),
  city: z.string().default(""),
  country: z.string().default(""),
  continent: z.string().default(""),
  device: z.string().default(""),
  region_code: z.string().default(""),
  timezone: z.string().default(""),
  language: z.string(),
  os: z.string(),
  page: z.string(),
  screen: z.string(),
});

app.get("/", (c) => {
  return c.text("Hello OpenStatus!");
});

app.post("/", zValidator("json", z.array(schema)), async (c) => {
  const data = c.req.valid("json");
  const userAgent = c.req.header("user-agent") || "";

  const country = c.req.header("cf-ipcountry") || "";
  const city = c.req.header("cf-ipcity") || "";
  const region_code = c.req.header("cf-region-code") || "";
  const timezone = c.req.header("cf-timezone") || "";
  const browser = browserName(userAgent) || "";

  const os = detectOS(userAgent) || "";
  const payload = data.map((d) => {
    return chSchema.parse({
      ...d,
      browser,
      country,
      city,
      timezone,
      region_code,
      os,
    });
  });

  const insert = async () => {
    const res = [];
    for (const p of payload) {
      const r = fetch(c.env.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(p),
      });
      res.push(r);
    }
    await Promise.allSettled(res);
  };
  c.executionCtx.waitUntil(insert());
  return c.json({ status: "ok" }, 200);
});

export default app;
