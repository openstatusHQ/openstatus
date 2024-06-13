import puppeteer from "@cloudflare/puppeteer";
import { zValidator } from "@hono/zod-validator";
import { createClient } from "@libsql/client/web";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { z } from "zod";

import { incidentTable } from "@openstatus/db/src/schema/incidents/incident";

type Bindings = {
  MYBROWSER: Fetcher;
  MY_BUCKET: R2Bucket;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
  HEADER_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const createDrizzleClient = (env: Bindings) => {
  const url = env.DATABASE_URL?.trim();
  if (url === undefined) {
    throw new Error("DATABASE_URL env var is not defined");
  }

  const authToken = env.DATABASE_AUTH_TOKEN?.trim();
  if (authToken === undefined) {
    throw new Error("DATABASE_AUTH_TOKEN env var is not defined");
  }

  return drizzle(createClient({ url, authToken }));
};

app.post(
  "/",
  zValidator(
    "json",
    z.object({
      url: z.string().url(),
      incidentId: z.number(),
      kind: z.enum(["incident", "recovery"]),
    }),
  ),
  async (c) => {
    const auth = c.req.header("Authorization");
    if (auth !== `Basic ${c.env.HEADER_TOKEN}`) {
      console.error("Unauthorized");
      return c.text("Unauthorized", 401);
    }

    const data = c.req.valid("json");

    const env = c.env;
    const db = createDrizzleClient(env);

    const sessionId = await getRandomSession(env.MYBROWSER);
    // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
    let browser;
    if (sessionId) {
      try {
        browser = await puppeteer.connect(env.MYBROWSER, sessionId);
      } catch (e) {
        // another worker may have connected first
        console.log(`Failed to connect to ${sessionId}. Error ${e}`);
      }
    }
    if (!browser) {
      // No open sessions, launch new session
      browser = await puppeteer.launch(env.MYBROWSER);
    }

    const page = await browser.newPage();
    await page.goto(data.url, { waitUntil: "networkidle2" });
    const img = await page.screenshot();
    await browser.disconnect();
    const id = `${data.incidentId}-${Date.now()}.png`;
    const url = `https://screenshot.openstat.us/${id}`;
    await c.env.MY_BUCKET.put(id, img);
    if (data.kind === "incident") {
      await db
        .update(incidentTable)
        .set({ incidentScreenshotUrl: url })
        .where(eq(incidentTable.id, data.incidentId))
        .run();
    }
    if (data.kind === "recovery") {
      await db
        .update(incidentTable)
        .set({ recoveryScreenshotUrl: url })
        .where(eq(incidentTable.id, data.incidentId))
        .run();
    }
    return c.text("Screenshot saved");
  },
);
const getRandomSession = async (
  endpoint: puppeteer.BrowserWorker,
): Promise<string | undefined> => {
  const sessions: puppeteer.ActiveSession[] =
    await puppeteer.sessions(endpoint);
  console.log(`Sessions: ${JSON.stringify(sessions)}`);
  const sessionsIds = sessions
    .filter((v) => {
      return !v.connectionId; // remove sessions with workers connected to them
    })
    .map((v) => {
      return v.sessionId;
    });
  if (sessionsIds.length === 0) {
    return;
  }

  const sessionId = sessionsIds[Math.floor(Math.random() * sessionsIds.length)];

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  return sessionId!;
};
export default app;
