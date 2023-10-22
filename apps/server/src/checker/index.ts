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
    // catchTooManyRetry(result.data);
    return c.text("Ok", 200); // finish the task
  }

  console.log(`Google Checker should try this: ${result.data.url}`);

  try {
    console.log(
      `start checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    await checkerRetryPolicy(result.data, retry);
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
  console.log("Retry : ", c.req.header("X-CloudTasks-TaskRetryCount"));

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const retry = Number(c.req.header("X-CloudTasks-TaskRetryCount") || 0);
  if (retry > 1) {
    console.error(
      `catchTooManyRetry for ${JSON.stringify(result.data)}
      )}`,
    );
    // catchTooManyRetry(result.data);
    return c.text("Ok", 200); // finish the task
  }

  console.log(`Google Checker should try this: ${result.data.url}`);

  try {
    console.log(
      `start checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    await checkerRetryPolicy(result.data, retry);
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
    return c.text("Internal Server Error", 500);
  }
});
