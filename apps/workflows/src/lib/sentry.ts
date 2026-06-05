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
