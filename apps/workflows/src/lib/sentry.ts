import * as Sentry from "@sentry/node";

import { env } from "../env";

Sentry.init({
  dsn: env().SENTRY_DSN,
  environment: env().NODE_ENV,
  tracesSampleRate: 0,
  // Tracing is off; the ESM hooks only feed auto-instrumentation and use the
  // deprecated module.register() (DEP0205).
  registerEsmLoaderHooks: false,
});

export type SentryMonitorConfig = NonNullable<
  Parameters<typeof Sentry.captureCheckIn>[1]
>;

/**
 * Passing `monitorConfig` upserts the Sentry monitor from code, so a schedule
 * defined in this repo does not also need configuring in Sentry.
 */
export function runSentryCron(
  monitorSlug: string,
  monitorConfig?: SentryMonitorConfig,
): {
  cronCompleted: () => Promise<void>;
  cronFailed: () => Promise<void>;
} {
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug, status: "in_progress" },
    monitorConfig,
  );
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
