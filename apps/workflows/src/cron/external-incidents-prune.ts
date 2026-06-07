import { getLogger } from "@logtape/logtape";
import { pruneStaleRawPayloads } from "@openstatus/services/external-service-incident";
import { Effect } from "effect";
import type { Context } from "hono";

import { db } from "@openstatus/db";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "external-incidents-prune"]);

export async function runExternalIncidentsPruneTick(): Promise<{
  purged: number;
}> {
  return pruneStaleRawPayloads({ ctx: { db } });
}

export async function handleExternalIncidentsPruneCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron(
    "external-incidents-prune",
  );

  void Effect.runPromise(
    Effect.tryPromise({
      try: () => runExternalIncidentsPruneTick(),
      catch: (e) =>
        new Error(
          `external-incidents-prune tick failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }).pipe(
      Effect.tap((res) =>
        Effect.sync(() => {
          logger.info(
            "external-incidents-prune tick complete: purged={purged}",
            { purged: res.purged },
          );
          void cronCompleted();
        }),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          logger.error("external-incidents-prune tick errored: {message}", {
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
