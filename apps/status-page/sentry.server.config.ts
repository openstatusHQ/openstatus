// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// tRPC error codes that should not be reported to Sentry (expected client errors)
const IGNORED_TRPC_CODES = ["UNAUTHORIZED", "NOT_FOUND", "BAD_REQUEST"];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.2,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  beforeSend(event) {
    // Filter out expected tRPC errors (401, 404, 400)
    const message = event.exception?.values?.[0]?.value || "";
    if (IGNORED_TRPC_CODES.some((code) => message.includes(code))) {
      return null;
    }
    return event;
  },
});
