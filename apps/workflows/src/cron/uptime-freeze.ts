import { getLogger } from "@logtape/logtape";
import {
  type UptimeFreezePipes,
  runUptimeFreeze,
} from "@openstatus/services/frozen-uptime";
import { OSTinybird } from "@openstatus/tinybird";
import type { Context } from "hono";

import { env } from "../env";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "uptime-freeze"]);

const tb = new OSTinybird(env().TINY_BIRD_API_KEY);

const pipes: UptimeFreezePipes = {
  http: tb.httpStatus45d,
  tcp: tb.tcpStatus45d,
  dns: tb.dnsStatus45d,
};

export async function handleUptimeFreezeCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron("uptime-freeze");

  // Background chain: must not capture `c` or anything derived from it —
  // the handler returns 200 before this resolves (see external-status.ts)
  void runUptimeFreeze({
    pipes,
    onChunkFailure: ({ jobType, error }) => {
      logger.warn("uptime-freeze: tinybird {jobType} chunk failed: {reason}", {
        jobType,
        reason: error instanceof Error ? error.message : String(error),
      });
    },
  })
    .then(async (res) => {
      if (res.failures.length > 0) {
        // isolate: a Sentry transport failure must not flip a completed
        // freeze run into cronFailed via the outer catch
        try {
          await reportBackgroundError(
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
