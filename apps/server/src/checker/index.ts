import { Hono } from "hono";

import { env } from "../env";
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
