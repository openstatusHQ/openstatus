import { Hono } from "hono";
import { z } from "zod";

import { flyRegions } from "@openstatus/db/src/schema/monitors/constants";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { upsertMonitorStatus } from "./alerting";
import { checkerRetryPolicy } from "./checker";
import { payloadSchema } from "./schema";
import type { Payload } from "./schema";

export type Variables = {
  payload: Payload;
};

export const checkerRoute = new Hono<{ Variables: Variables }>();

// TODO: only use checkerRoute.post("/checker", checker);

checkerRoute.post("/checker", async (c) => {
  const json = await c.req.json();
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env.CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }
  console.log("Retry : ", c.req.header("X-CloudTasks-TaskRetryCount"));

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const retry = Number(c.req.header("X-CloudTasks-TaskRetryCount") || 0);
  if (retry > 3) {
    console.error(
      `catchTooManyRetry for ${JSON.stringify(result.data)}
      )}`,
    );
    return c.text("Ok", 200); // finish the task
  }

  try {
    console.log(
      `start checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    await checkerRetryPolicy(result.data);
    console.log(
      `end checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    return c.text("Ok", 200);
  } catch (e) {
    console.error(
      `fail checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
      JSON.stringify(result.data),
      e,
    );
    if (result.data.status === "error") {
      console.log(
        `The monitor was already in error we should not retry checker URL: ${result.data}`,
      );
      return c.text("Ok", 200);
    }
    return c.text("Internal Server Error", 500);
  }
});

checkerRoute.post("/checkerV2", async (c) => {
  const json = await c.req.json();

  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env.CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const retry = Number(c.req.header("X-CloudTasks-TaskRetryCount") || 0);
  if (retry > 2) {
    console.error(
      `⛔ Too many retry for ${JSON.stringify(result.data)}
      )}`,
    );
    // catchTooManyRetry(result.data);
    return c.text("Ok", 200); // finish the task
  }
  if (retry > 0 && result.data.status === "error") {
    console.log(
      `🗑️  The monitor was already in error we should not checked the URL: ${result.data}`,
    );
    return c.text("Ok", 200);
  }

  try {
    console.log(`🧭 start checker for: ${JSON.stringify(result.data)}`);
    await checkerRetryPolicy(result.data);
    console.log(`🔚 end checker for: ${JSON.stringify(result.data)} `);
    return c.text("Ok", 200);
  } catch (e) {
    if (result.data.status === "error") {
      console.log(
        `🗑️  The monitor was already in error we should not retry checker URL: ${result.data}`,
      );
      return c.text("Ok", 200);
    }
    console.error(
      `🔴 fail checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
      JSON.stringify(result.data),
      e,
    );
    return c.text("Internal Server Error", 500);
  }
});

checkerRoute.post("/statusChange", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env.CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const json = await c.req.json();
  const schema = z.object({
    monitorId: z.string(),
    status: z.enum(["active", "error"]), // that's the new status
    message: z.string().optional(),
    statusCode: z.number().optional(),
    region: z.enum(flyRegions),
  });

  const result = schema.safeParse(json);
  if (!result.success) {
    // console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, status, message, region, statusCode } = result.data;

  console.log(`📝 update monitor status ${JSON.stringify(result.data)}`);

  switch (status) {
    case "active":
      await upsertMonitorStatus({
        monitorId: monitorId,
        status: "active",
        region: region,
      });
      if (!statusCode) {
        return;
      }
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.recovered",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: { region: region, statusCode: statusCode },
      });
      break;
    case "error":
      await upsertMonitorStatus({
        monitorId: monitorId,
        status: "error",
        region: region,
      });
      // ALPHA
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.failed",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region: region,
          statusCode: statusCode,
          message,
        },
      });
      break;
  }
  return c.text("Ok", 200);
});
