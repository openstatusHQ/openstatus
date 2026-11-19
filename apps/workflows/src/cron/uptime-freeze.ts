import { getLogger } from "@logtape/logtape";
import {
  BackfillFrozenBucketsInput,
  backfillBucketPipe,
  backfillFrozenBuckets,
  freezeCutoff,
  previousMonth,
  RefreezeMonitorMonthsInput,
  type RunUptimeFreezeResult,
  refreezeMonitorMonths,
  runUptimeFreeze,
  type UptimeBadBucketPipes,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
  uptimeBadBucketPipes,
  uptimeFreezePipes,
  uptimeRunsPipes,
} from "@openstatus/services/frozen-uptime";
import { OSTinybird } from "@openstatus/tinybird";
import type { Context } from "hono";

import { env } from "../env";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "uptime-freeze"]);

const tb = new OSTinybird({
  token: env().TINY_BIRD_API_KEY,
  baseUrl: env().TINYBIRD_URL,
  noop: env().TINYBIRD_NOOP,
});

const CUTOFF_WARNING_MS = 3 * 86_400_000;

type FreezeOptions = {
  pipes?: UptimeFreezePipes;
  runsPipes?: UptimeRunsPipes;
  badPipes?: UptimeBadBucketPipes;
  now?: Date;
  monitorIds?: number[];
  sleep?: (ms: number) => Promise<void>;
  report?: (message: string) => Promise<void>;
};

const defaults = {
  pipes: uptimeFreezePipes(tb),
  runsPipes: uptimeRunsPipes(tb),
  badPipes: uptimeBadBucketPipes(tb),
  backfillPipe: backfillBucketPipe(tb),
  report: reportBackgroundError,
};

function logChunkFailure({
  pipe,
  jobType,
  error,
}: {
  pipe: string;
  jobType: string;
  error: unknown;
}) {
  logger.warn(
    "uptime-freeze: tinybird {jobType} {pipe} chunk failed: {reason}",
    {
      pipe,
      jobType,
      reason: error instanceof Error ? error.message : String(error),
    },
  );
}

// isolate: a Sentry transport failure must not flip a completed run into a failed one
async function safeReport(
  report: (message: string) => Promise<void>,
  message: string,
) {
  try {
    await report(message);
  } catch (reportError) {
    logger.warn("uptime-freeze: reportBackgroundError failed: {reason}", {
      reason:
        reportError instanceof Error
          ? reportError.message
          : String(reportError),
    });
  }
}

async function reportResult(
  label: string,
  res: RunUptimeFreezeResult,
  report: (message: string) => Promise<void>,
) {
  if (res.failures.length > 0) {
    await safeReport(
      report,
      `${label} ${res.month}: ${res.failures.length} failures (frozen=${res.frozen}, alreadyFrozen=${res.alreadyFrozen}, skipped=${res.skipped}). First: ${res.failures.slice(0, 5).join("; ")}`,
    );
  }
  if (res.bucketMismatch > 0) {
    await safeReport(
      report,
      `${label} ${res.month}: ${res.bucketMismatch} monitors frozen without bad ranges (bucket sums did not match the day counts)`,
    );
  }
  logger.info(
    `${label} complete: month={month} frozen={frozen} alreadyFrozen={alreadyFrozen} skipped={skipped} bucketMismatch={bucketMismatch} failed={failed}`,
    { ...res, failed: res.failures.length },
  );
}

async function freezeAndReport(
  options: FreezeOptions,
): Promise<RunUptimeFreezeResult> {
  const { report = defaults.report, ...rest } = options;
  const res = await runUptimeFreeze({
    pipes: defaults.pipes,
    runsPipes: defaults.runsPipes,
    badPipes: defaults.badPipes,
    ...rest,
    onChunkFailure: logChunkFailure,
  });
  await reportResult("uptime-freeze", res, report);
  return res;
}

/**
 * Daily in-process freeze. Returns null past the 45-day cutoff, where the
 * freeze would only report its refusal every day until the month rolls over.
 */
export async function runUptimeFreezeTick(
  options: FreezeOptions = {},
): Promise<RunUptimeFreezeResult | null> {
  const now = options.now ?? new Date();
  const remainingMs = freezeCutoff(previousMonth(now)) - now.getTime();
  if (remainingMs <= 0) return null;
  const res = await freezeAndReport({ ...options, now });
  // every failure is a monitor that had a month to freeze and has not
  if (remainingMs < CUTOFF_WARNING_MS && res.failures.length > 0) {
    await safeReport(
      options.report ?? defaults.report,
      `uptime-freeze ${res.month}: ${res.failures.length} monitors with data still unfrozen, ${Math.floor(remainingMs / 3_600_000)}h before the 45d Tinybird cutoff`,
    );
  }
  return res;
}

export async function handleUptimeFreezeCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron("uptime-freeze");

  // Background chain: must not capture `c` or anything derived from it —
  // the handler returns 200 before this resolves (see the /checker route in ./index.ts)
  void freezeAndReport({})
    .then(() => {
      void cronCompleted();
    })
    .catch((e) => {
      logger.error("uptime-freeze errored: {message}", {
        message: e instanceof Error ? e.message : String(e),
      });
      void reportBackgroundError(
        `uptime-freeze failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      void cronFailed();
    });

  return c.json({ success: true }, 200);
}

/** `GET /uptime-freeze/refreeze?month=YYYY-MM-01&monitorIds=1,2[&force=true]` */
export async function handleUptimeRefreeze(c: Context) {
  const parsed = RefreezeMonitorMonthsInput.safeParse({
    month: c.req.query("month"),
    monitorIds: (c.req.query("monitorIds") ?? "")
      .split(",")
      .filter((id) => id.trim() !== "")
      .map(Number),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message }, 400);
  }

  const res = await refreezeMonitorMonths({
    pipes: defaults.pipes,
    runsPipes: defaults.runsPipes,
    badPipes: defaults.badPipes,
    ...parsed.data,
    force: c.req.query("force") === "true",
    onChunkFailure: logChunkFailure,
  });
  if (res.held) {
    return c.json(
      {
        success: false,
        error:
          res.failures[0] ??
          `month ${res.month} is inside the 48h hold; pass force=true to refreeze now`,
        ...res,
      },
      409,
    );
  }
  await reportResult("uptime-refreeze", res, defaults.report);
  return c.json({ success: res.failures.length === 0, ...res }, 200);
}

/** `GET /uptime-freeze/backfill-buckets?month=YYYY-MM-01[&monitorIds=1,2]` */
export async function handleUptimeBackfillBuckets(c: Context) {
  const ids = (c.req.query("monitorIds") ?? "")
    .split(",")
    .filter((id) => id.trim() !== "")
    .map(Number);
  const parsed = BackfillFrozenBucketsInput.safeParse({
    month: c.req.query("month"),
    monitorIds: ids.length > 0 ? ids : undefined,
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message }, 400);
  }

  const res = await backfillFrozenBuckets({
    pipe: defaults.backfillPipe,
    ...parsed.data,
    onChunkFailure: logChunkFailure,
  });
  logger.info(
    "uptime-backfill-buckets complete: month={month} updated={updated} mismatched={mismatched} skipped={skipped} failed={failed}",
    { ...res },
  );
  return c.json({ success: res.failed === 0, ...res }, 200);
}
