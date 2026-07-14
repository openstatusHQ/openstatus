import { getLogger } from "@logtape/logtape";

import { env } from "./env";
import { app } from "./index";

const port = 3000;

// Deno terminates the process on unhandled rejections; log instead so one
// stray background promise (e.g. a fire-and-forget fetch) can't kill the instance.
globalThis.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  getLogger("api-server").error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  event.preventDefault();
});

getLogger("api-server").info("Starting server", {
  port,
  environment: env.NODE_ENV,
});

Deno.serve({ port }, app.fetch);
