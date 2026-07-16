// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import type { TRPCError } from "@trpc/server";

// tRPC error codes that should not be reported to Sentry (expected client errors)
const IGNORED_TRPC_CODES: TRPCError["code"][] = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
];

// Match by name + code rather than `instanceof TRPCError`: the thrown error
// comes from the app bundle, whose `@trpc/server` class identity differs from
// the copy this instrumentation config would import at runtime.
function isIgnoredTRPCError(err: unknown): err is TRPCError {
  return (
    err instanceof Error &&
    err.name === "TRPCError" &&
    IGNORED_TRPC_CODES.includes((err as TRPCError).code)
  );
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.2,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  beforeSend(event, hint) {
    if (isIgnoredTRPCError(hint.originalException)) {
      return null;
    }
    return event;
  },
});
