import { getLogger } from "@logtape/logtape";
import {
  type RedirectUriRejectedError,
  redirectUriOrigin,
} from "@openstatus/services/oauth";
import type { Context } from "hono";

import { wideEvent } from "@/libs/middlewares/shed";

const counter = getLogger("api-server-otel");

/**
 * `/oauth/register` is open, so Sentry keeps one event per origin per window
 * while the counter below stays unsampled. Fixed slots rather than a map of
 * seen origins: nothing is ever evicted, so a flood of new origins cannot
 * reset the window of one already seen and then replay it for a fresh event.
 * Colliding origins share a window, costing at most a skipped Sentry event.
 */
const CAPTURE_WINDOW_MS = 10 * 60_000;
const CAPTURE_SLOTS = 1024;
const lastCapturedAt = new Float64Array(CAPTURE_SLOTS);

function slotFor(origin: string): number {
  let hash = 2166136261;
  for (let i = 0; i < origin.length; i++) {
    hash ^= origin.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % CAPTURE_SLOTS;
}

function shouldCapture(origin: string, now: number): boolean {
  const slot = slotFor(origin);
  // A zeroed slot was never captured, and `now` is always past the window.
  if (now - lastCapturedAt[slot] < CAPTURE_WINDOW_MS) return false;
  lastCapturedAt[slot] = now;
  return true;
}

/** Test seam: the window is process-wide and would leak across cases. */
export function resetRedirectUriCaptureWindow(): void {
  lastCapturedAt.fill(0);
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
