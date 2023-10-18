import { Receiver } from "@upstash/qstash";
import { Hono } from "hono";

import { env } from "../env";
import { catchTooManyRetry } from "./alerting";
import { checker } from "./checker";
import { payloadSchema } from "./schema";
import type { Payload } from "./schema";

export type Variables = {
  payload: Payload;
};

const r = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

export const checkerRoute = new Hono<{ Variables: Variables }>();

// TODO: only use checkerRoute.post("/checker", checker);
checkerRoute.post("/checker", async (c) => {
  const json = await c.req.json();

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }

  if (Number(c.req.header("Upstash-Retried") || 0) >= 2) {
    console.log(
      `catchTooManyRetry for ${result.data.url} with retry nb ${c.req.header(
        "Upstash-Retried",
      )}`,
    );
    catchTooManyRetry(result.data);
    return c.text("Ok", 200); // needs to be 200, otherwise qstash will retry
  }

  try {
    console.log(`start checker for ${result.data.url}`);
    checker(result.data);
    console.log(`end checker for ${result.data.url}`);
    return c.text("Ok", 200);
  } catch (e) {
    console.error(e);
    return c.text("Internal Server Error", 500);
  }
});
