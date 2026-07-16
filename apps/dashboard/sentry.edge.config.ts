// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

// tRPC error codes that should not be reported to Sentry (expected client errors)
const IGNORED_TRPC_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
];

// Duck-typed: `instanceof TRPCError` is unreliable here because the thrown
// error comes from a different bundle than this config's `@trpc/server` copy.
function isIgnoredTRPCError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.name === "TRPCError" &&
    IGNORED_TRPC_CODES.includes((err as { code?: string }).code ?? "")
  );
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0,

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
