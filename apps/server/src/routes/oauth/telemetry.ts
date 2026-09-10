import { getLogger } from "@logtape/logtape";
import {
  type RedirectUriRejectedError,
  redirectUriOrigin,
} from "@openstatus/services/oauth";
import type { Context } from "hono";

import { wideEvent } from "@/libs/middlewares/shed";

const counter = getLogger("api-server-otel");

// `/oauth/register` is open, so a flood cannot be ruled out: Sentry keeps one
// event per origin per window, the counter below stays unsampled.
const CAPTURE_WINDOW_MS = 10 * 60_000;
const MAX_TRACKED_ORIGINS = 1024;
const lastCapturedAt = new Map<string, number>();

function shouldCapture(origin: string, now: number): boolean {
  const previous = lastCapturedAt.get(origin);
  if (previous !== undefined && now - previous < CAPTURE_WINDOW_MS) {
    return false;
  }
  if (lastCapturedAt.size >= MAX_TRACKED_ORIGINS) {
    for (const [tracked, at] of lastCapturedAt) {
      if (now - at >= CAPTURE_WINDOW_MS) lastCapturedAt.delete(tracked);
    }
    // A flood of distinct origins outruns the pruning; drop the window instead
    // of the machine's memory.
    if (lastCapturedAt.size >= MAX_TRACKED_ORIGINS) lastCapturedAt.clear();
  }
  lastCapturedAt.set(origin, now);
  return true;
}

/** Test seam: the window is process-wide and would leak across cases. */
export function resetRedirectUriCaptureWindow(): void {
  lastCapturedAt.clear();
}

function groupByOrigin(rejected: string[]): Map<string, string[]> {
  const byOrigin = new Map<string, string[]>();
  for (const uri of rejected) {
    const origin = redirectUriOrigin(uri);
    const uris = byOrigin.get(origin);
    if (uris) uris.push(uri);
    else byOrigin.set(origin, [uri]);
  }
  return byOrigin;
}

/**
 * Counts the rejection by origin — the reject path doubles as a map of which
 * agent surfaces try to reach us — and reports it as a warning grouped by
 * origin rather than an error grouped by the full URI.
 */
export function reportRedirectUriRejected(
  err: RedirectUriRejectedError,
  c: Context,
): void {
  const byOrigin = groupByOrigin(err.rejected);
  const origins = [...byOrigin.keys()];

  const event = wideEvent(c);
  if (event) {
    event.oauth_register_rejected = true;
    event.oauth_register_rejected_origins = origins;
  }

  const sentry = c.get("sentry");
  const now = Date.now();
  for (const [origin, uris] of byOrigin) {
    counter.info("oauth_register_redirect_uri_rejected", {
      metric: "oauth.register.redirect_uri_rejected",
      value: uris.length,
      origin,
      user_agent: c.req.header("User-Agent"),
    });
    if (!sentry || !shouldCapture(origin, now)) continue;
    sentry.withScope((scope) => {
      scope.setFingerprint([
        "oauth",
        "register",
        "redirect_uri_rejected",
        origin,
      ]);
      scope.setContext("redirect_uri", { origin, rejected: uris });
      scope.captureMessage("redirect_uri host not allowlisted", "warning");
    });
  }
}
