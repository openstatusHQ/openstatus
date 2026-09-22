import { getLogger } from "@logtape/logtape";
import { db } from "@openstatus/db";
import {
  type PruneExpiredResult,
  pruneExpired,
} from "@openstatus/services/oauth";
import { Effect } from "effect";
import type { Context } from "hono";

import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "oauth-prune"]);

export async function runOAuthPruneTick(): Promise<PruneExpiredResult> {
  return pruneExpired({ ctx: { db } });
}

export async function handleOAuthPruneCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron("oauth-prune");

  void Effect.runPromise(
    Effect.tryPromise({
      try: () => runOAuthPruneTick(),
      catch: (e) =>
        new Error(
          `oauth-prune tick failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }).pipe(
      Effect.tap((res) =>
        Effect.sync(() => {
          logger.info(
            "oauth-prune tick complete: sessions={sessions} codes={codes} grants={grants} clients={clients}",
            res,
          );
          void cronCompleted();
        }),
      ),
      Effect.catch((e) =>
        Effect.sync(() => {
          logger.error("oauth-prune tick errored: {message}", {
            message: e.message,
          });
          void reportBackgroundError(e.message);
          void cronFailed();
        }),
      ),
    ),
  );

  return c.json({ success: true }, 200);
}
