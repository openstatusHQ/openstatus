import { getLogger } from "@logtape/logtape";
import {
  FREEZE_CUTOFF_MS,
  monthRange,
  previousMonth,
  type RunUptimeFreezeResult,
  runUptimeFreeze,
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

type FreezeOptions = Partial<
  Pick<
    Parameters<typeof runUptimeFreeze>[0],
    "pipes" | "runsPipes" | "now" | "monitorIds" | "sleep"
  >
> & { report?: (message: string) => Promise<void> };

const defaults = {
  pipes: uptimeFreezePipes(tb),
  runsPipes: uptimeRunsPipes(tb),
  report: reportBackgroundError,
};

async function freezeAndReport(
  options: FreezeOptions,
): Promise<RunUptimeFreezeResult> {
  const { report = defaults.report, ...rest } = options;
  const res = await runUptimeFreeze({
    pipes: defaults.pipes,
    runsPipes: defaults.runsPipes,
    ...rest,
    onChunkFailure: ({ pipe, jobType, error }) => {
      logger.warn(
        "uptime-freeze: tinybird {jobType} {pipe} chunk failed: {reason}",
        {
          pipe,
          jobType,
          reason: error instanceof Error ? error.message : String(error),
        },
      );
    },
  });
  if (res.failures.length > 0) {
    // isolate: a Sentry transport failure must not flip a completed
    // freeze run into a failed one
    try {
      await report(
        `uptime-freeze ${res.month}: ${res.failures.length} failures (frozen=${res.frozen}, alreadyFrozen=${res.alreadyFrozen}, skipped=${res.skipped}). First: ${res.failures.slice(0, 5).join("; ")}`,
      );
    } catch (reportError) {
      logger.warn("uptime-freeze: reportBackgroundError failed: {reason}", {
        reason:
          reportError instanceof Error
            ? reportError.message
            : String(reportError),
      });
    }
  }
  logger.info(
    "uptime-freeze complete: month={month} frozen={frozen} alreadyFrozen={alreadyFrozen} skipped={skipped} failed={failed}",
    { ...res, failed: res.failures.length },
  );
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
  const monthStart = monthRange(previousMonth(now)).start;
  if (now.getTime() - monthStart >= FREEZE_CUTOFF_MS) return null;
  return freezeAndReport({ ...options, now });
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
