import { Receiver } from "@upstash/qstash";
import type { Context, Next } from "hono";

import { env } from "../env";
import { catchTooManyRetry } from "./alerting";
import type { Variables } from "./index";
import { payloadSchema } from "./schema";

const r = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

export async function middleware(
  c: Context<{ Variables: Variables }, "/*", {}>,
  next: Next,
) {
  const json = await c.req.json();

  const isValid = r.verify({
    signature: c.req.header("Upstash-Signature") || "",
    body: JSON.stringify(json),
  });

  if (!isValid) {
    return c.text("Unauthorized", 401);
  }

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }

  /**
   * Alert user after third retry, on forth try
   */
  if (c.req.header("Upstash-Retried") === "3") {
    catchTooManyRetry(result.data);
    return c.text("", 200); // needs to be 200, otherwise qstash will retry
  }

  c.set("payload", result.data);
  await next();
}
