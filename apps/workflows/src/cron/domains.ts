import { getLogger } from "@logtape/logtape";
import { db } from "@openstatus/db";
import {
  createVercelClient,
  DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS,
  isVercelConfigured,
  pruneUnverifiedDomains,
  type PruneUnverifiedDomainsOptions,
  type PruneUnverifiedDomainsResult,
} from "@openstatus/services/page";
import { Effect } from "effect";
import type { Context } from "hono";

import { env } from "../env";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "domains-prune"]);

export async function runDomainsPruneTick(
  opts?: Partial<PruneUnverifiedDomainsOptions>,
): Promise<PruneUnverifiedDomainsResult> {
  const e = env();
  const vercelOpts = {
    projectId: e.PROJECT_ID_VERCEL,
    teamId: e.TEAM_ID_VERCEL,
    bearerToken: e.VERCEL_AUTH_BEARER_TOKEN,
  };

  if (!opts?.vercel && !isVercelConfigured(vercelOpts)) {
    logger.info("Vercel is not configured on this instance, skipping domains prune tick");
    return {
      totalChecked: 0,
      verifiedCount: 0,
      unverifiedCount: 0,
      removedFromVercel: [],
      clearedFromDb: [],
      errors: [],
    };
  }

  const vercel = opts?.vercel ?? createVercelClient(vercelOpts);

  return pruneUnverifiedDomains({
    db,
    vercel,
    olderThanMs: opts?.olderThanMs,
    dryRun: opts?.dryRun,
    now: opts?.now,
  });
}

export async function handleDomainsPruneCron(c: Context) {
  const olderThanDaysQuery = c.req.query("olderThanDays");
  const dryRunQuery = c.req.query("dryRun");

  let olderThanMs = DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS;
  if (olderThanDaysQuery !== undefined) {
    const parsedDays = Number(olderThanDaysQuery);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      return c.json(
        { error: "Invalid olderThanDays parameter: must be a positive number" },
        400,
      );
    }
    olderThanMs = parsedDays * 24 * 60 * 60 * 1000;
  }

  const dryRun = dryRunQuery === "true" || dryRunQuery === "1";

  const { cronCompleted, cronFailed } = runSentryCron("domains-prune");

  void Effect.runPromise(
    Effect.tryPromise({
      try: () => runDomainsPruneTick({ olderThanMs, dryRun }),
      catch: (e) =>
        new Error(
          `domains-prune tick failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }).pipe(
      Effect.tap((res) =>
        Effect.sync(() => {
          logger.info(
            "domains-prune tick complete: checked={totalChecked} verified={verifiedCount} unverified={unverifiedCount} removedFromVercel={removedFromVercelCount} clearedFromDb={clearedFromDbCount} errors={errorsCount}",
            {
              totalChecked: res.totalChecked,
              verifiedCount: res.verifiedCount,
              unverifiedCount: res.unverifiedCount,
              removedFromVercelCount: res.removedFromVercel.length,
              clearedFromDbCount: res.clearedFromDb.length,
              errorsCount: res.errors.length,
            },
          );
          if (res.errors.length > 0) {
            void reportBackgroundError(
              `domains-prune encountered ${res.errors.length} errors: ${res.errors.map((err) => `${err.domain}: ${err.error}`).join("; ")}`,
            );
          }
          void cronCompleted();
        }),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          logger.error("domains-prune tick errored: {message}", {
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
