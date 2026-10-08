import { FetchError } from "@openstatus/status-fetcher";
import * as Sentry from "@sentry/deno";
import type { SeverityLevel } from "@sentry/deno";

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
  | { kind: "schema-mismatch" }
  | { kind: "none" };

// One event tells the whole story of a probed tick: the fetch failure plus
// what detection concluded. Fingerprinted per (slug, outcome) so repeats
// collapse into a single issue; a schema mismatch is our bug, so it groups
// per provider instead.
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
          fingerprint: [
            "external-status-detect",
            slug,
            `applied:${outcome.provider}`,
          ],
          level: "info" as const,
          message: `provider auto-updated ${currentProvider} → ${outcome.provider}`,
        };
      case "config-cleared":
        return {
          fingerprint: ["external-status-detect", slug, "config-cleared"],
          level: "info" as const,
          message: `stale api_config cleared (provider ${currentProvider})`,
        };
      case "suggest":
        return {
          fingerprint: ["external-status-detect", slug, outcome.suggestion],
          level: "warning" as const,
          message: `provider suggestion: ${outcome.suggestion} (currently ${currentProvider})`,
        };
      case "schema-mismatch":
        return {
          fingerprint: ["external-status-detect", "schema", currentProvider],
          level: "error" as const,
          message: `JSON did not match the ${currentProvider} schema`,
        };
      case "none":
        return {
          fingerprint: ["external-status-detect", slug, "none"],
          level: "warning" as const,
          message: `failing, no provider detected (currently ${currentProvider})`,
        };
    }
  })();
  Sentry.captureMessage(`external-status: ${slug} ${story.message}`, {
    level: story.level,
    fingerprint: story.fingerprint,
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
  level?: SeverityLevel;
}): void {
  const { phase, slug, error, level } = args;
  Sentry.captureException(error, {
    level,
    fingerprint: [
      "external-status-fetch",
      slug,
      phase,
      error.kind ?? "unknown",
      String(error.httpStatus ?? ""),
    ],
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
