// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { CaptureConsole as CaptureConsoleIntegration } from "@sentry/integrations";
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f20616b5573f2a39dab718d99c8d9e38@o4505782661349376.ingest.sentry.io/4505782662791168",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  integrations: [
    new CaptureConsoleIntegration({
      // array of methods that should be captured
      // defaults to ['log', 'info', 'warn', 'error', 'debug', 'assert']
      levels: ["error"],
    }),
  ],
});
