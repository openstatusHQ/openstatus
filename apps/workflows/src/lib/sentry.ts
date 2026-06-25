import { FetchError } from "@openstatus/status-fetcher";
import * as Sentry from "@sentry/bun";

import { env } from "../env";

Sentry.init({
  dsn: env().SENTRY_DSN,
  environment: env().NODE_ENV,
  tracesSampleRate: 0,
});

export function runSentryCron(monitorSlug: string): {
  cronCompleted: () => Promise<void>;
  cronFailed: () => Promise<void>;
} {
  const checkInId = Sentry.captureCheckIn({
    monitorSlug,
    status: "in_progress",
  });
  return {
    cronCompleted: async () => {
      Sentry.captureCheckIn({ checkInId, monitorSlug, status: "ok" });
      await Sentry.flush();
    },
    cronFailed: async () => {
      Sentry.captureCheckIn({ checkInId, monitorSlug, status: "error" });
      await Sentry.flush();
    },
  };
}

export async function reportBackgroundError(message: string): Promise<void> {
  Sentry.captureMessage(message, "error");
  await Sentry.flush();
}

// Fires inside the per-service fetch loop, so no flush here — the tick's
// cronCompleted/cronFailed path flushes once the tick settles.
export function reportFetchFailure(args: {
  phase: "status" | "incidents" | "components";
  slug: string;
  error: FetchError;
}): void {
  const { phase, slug, error } = args;
  Sentry.captureException(error, {
    tags: {
      cron: "external-status",
      phase,
      slug,
      fetcher: error.fetcherName ?? "unknown",
      http_status: error.httpStatus,
    },
    extra: { url: error.url },
  });
}
