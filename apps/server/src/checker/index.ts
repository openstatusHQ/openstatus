import { Hono } from "hono";

import { env } from "../env";
import { catchTooManyRetry } from "./alerting";
import { checker } from "./checker";
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

  if (Number(c.req.header("X-CloudTasks-TaskRetryCount") || 0) > 5) {
    console.error(
      `catchTooManyRetry for ${JSON.stringify(result.data)}
      )}`,
    );
    // catchTooManyRetry(result.data);
    return c.text("Ok", 200); // needs to be 200, otherwise qstash will retry
  }

  console.log(`Google Checker should try this: ${result.data.url}`);

  try {
    console.log(
      `start checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    checker(result.data);
    console.log(
      `end checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    return c.text("Ok", 200);
  } catch (e) {
    console.error(e);
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

  if (Number(c.req.header("X-CloudTasks-TaskRetryCount") || 0) > 5) {
    console.error(
      `catchTooManyRetry for ${JSON.stringify(result.data)}
      )}`,
    );
    // catchTooManyRetry(result.data);
    return c.text("Ok", 200); // needs to be 200, otherwise qstash will retry
  }

  console.log(`Google Checker should try this: ${result.data.url}`);

  try {
    console.log(
      `start checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    checker(result.data);
    console.log(
      `end checker URL: ${result.data.url} monitorId ${result.data.monitorId}`,
    );
    return c.text("Ok", 200);
  } catch (e) {
    console.error(e);
    return c.text("Internal Server Error", 500);
  }
});
