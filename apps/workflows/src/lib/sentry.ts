import { FetchError } from "@openstatus/status-fetcher";
import * as Sentry from "@sentry/deno";

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

export type DetectionOutcome =
  | { kind: "applied"; provider: string }
  | { kind: "config-cleared" }
  | { kind: "suggest"; suggestion: string }
  | { kind: "none" };

// One event tells the whole story of a probed tick: the fetch failure plus
// what detection concluded. Fingerprinted per (slug, outcome) so repeats
// collapse into a single issue.
export function reportDetectionStory(args: {
  slug: string;
  currentProvider: string;
  fetchError?: FetchError;
  outcome: DetectionOutcome;
  evidence: string[];
}): void {
  const { slug, currentProvider, fetchError, outcome, evidence } = args;
  const story = (() => {
    switch (outcome.kind) {
      case "applied":
        return {
          key: `applied:${outcome.provider}`,
          level: "info" as const,
          message: `provider auto-updated ${currentProvider} → ${outcome.provider}`,
        };
      case "config-cleared":
        return {
          key: "config-cleared",
          level: "info" as const,
          message: `stale api_config cleared (provider ${currentProvider})`,
        };
      case "suggest":
        return {
          key: outcome.suggestion,
          level: "warning" as const,
          message: `provider suggestion: ${outcome.suggestion} (currently ${currentProvider})`,
        };
      case "none":
        return {
          key: "none",
          level: "error" as const,
          message: `failing, no provider detected (currently ${currentProvider})`,
        };
    }
  })();
  Sentry.captureMessage(`external-status: ${slug} ${story.message}`, {
    level: story.level,
    fingerprint: ["external-status-detect", slug, story.key],
    tags: {
      cron: "external-status",
      phase: "detect",
      slug,
      current_provider: currentProvider,
      outcome: outcome.kind,
    },
    extra: {
      evidence,
      fetchError: fetchError?.message,
      url: fetchError?.url,
    },
  });
}

export function reportDetectionWriteFailure(args: {
  slug: string;
  error: Error;
}): void {
  Sentry.captureException(args.error, {
    tags: { cron: "external-status", phase: "detect", slug: args.slug },
  });
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
