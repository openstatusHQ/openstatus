import { Cause, Effect, Exit, Option } from "effect";
import { Hono } from "hono";

import { acceptWebhook } from "../inbox/accept";
import { kickDrainer } from "../inbox/scheduler";

export const ingestRoute = new Hono();

const STATUS_BY_TAG: Record<string, number> = {
  AuthError: 401,
  PayloadTooLargeError: 413,
  RateLimitedError: 429,
};

ingestRoute.post("/:provider", async (c) => {
  const provider = c.req.param("provider");
  const exit = await Effect.runPromiseExit(acceptWebhook(c.req.raw, provider));

  if (Exit.isSuccess(exit)) {
    if (exit.value.row) kickDrainer(exit.value.row.id);
    return c.json({ accepted: true, duplicate: exit.value.duplicate }, 202);
  }

  const error = Option.getOrNull(Cause.findErrorOption(exit.cause));
  const tag = error && "_tag" in error ? String(error._tag) : "";
  const status = STATUS_BY_TAG[tag] ?? 500;
  const message =
    error && "reason" in error && typeof error.reason === "string"
      ? error.reason
      : tag || "ingest failed";

  return c.json(
    { accepted: false, error: message },
    status as 401 | 413 | 429 | 500,
  );
});
