import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { zValidator } from "@hono/zod-validator";
import { setMonitorIncidentScreenshot } from "@openstatus/services/monitor-incident";
import { Receiver } from "@upstash/qstash";
import { Hono } from "hono";
import playwright from "playwright";
import { z } from "zod";

import { env } from "./env";

const S3 = new S3Client({
  region: "auto",
  endpoint: env.R2_URL,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
});

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_SIGNING_SECRET,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_SECRET,
});

const app = new Hono();

app.get("/ping", (c) =>
  c.json({ ping: "pong", region: process.env.FLY_REGION }, 200),
);

app.post(
  "/",
  zValidator(
    "json",
    z.object({
      url: z.url(),
      incidentId: z.number(),
      kind: z.enum(["incident", "recovery"]),
    }),
  ),
  async (c) => {
    const signature = c.req.header("Upstash-Signature");
    // if (auth !== `Basic ${env.HEADER_TOKEN}`) {
    //   console.error("Unauthorized");
    //   return c.text("Unauthorized", 401);
    // }

    const data = c.req.valid("json");
    const isValid = receiver.verify({
      signature: signature || "",
      body: JSON.stringify(data),
    });
    if (!isValid) {
      console.error("Unauthorized");
      return c.text("Unauthorized", 401);
    }

    const browser = await playwright.chromium.launch({
      headless: true, // set this to true
    });

    // Only capture and upload fall back to the placeholder: a failed database
    // write must not replace a screenshot that was stored.
    let url: string | undefined;
    try {
      const page = await browser.newPage();
      await page.goto(data.url, { waitUntil: "load" });
      const img = await page.screenshot({ fullPage: true });
      const id = `${data.incidentId}-${Date.now()}.png`;

      await S3.send(
        new PutObjectCommand({
          Body: img,
          Bucket: "incident-screenshot",
          Key: id,
          ContentType: "image/png",
        }),
      );
      url = `https://screenshot.openstat.us/${id}`;
    } catch (e) {
      console.log("could not take screenshot timeout");
      console.log(e);
      if (data.kind === "incident") {
        url = "https://screenshot.openstat.us/err-connection-timed-out.jpg";
      }
    }

    if (url) {
      await setMonitorIncidentScreenshot({
        input: { id: data.incidentId, kind: data.kind, url },
        job: "screenshot-service",
      });
    }

    return c.text("Screenshot saved");
  },
);

export default app;
