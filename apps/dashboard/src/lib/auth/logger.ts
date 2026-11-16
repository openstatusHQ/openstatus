import type { LoggerInstance } from "@auth/core/types";
// Import from next-auth, not @auth/core: guarantees the same class next-auth
// throws, even if the catalog and next-auth pin different @auth/core versions.
import { AuthError } from "next-auth";

// Scanner probes Auth.js rejects at the boundary; logging them would create a
// Sentry issue per attacker-controlled payload via captureConsoleIntegration.
const boundaryRejectedProbeTypes = new Set([
  "UnknownAction",
  "InvalidCallbackUrl",
]);

/**
 * Auth.js' default logger, minus the scanner probes it rejects at the boundary.
 */
export const logger: Partial<LoggerInstance> = {
  error(error) {
    if (
      error instanceof AuthError &&
      boundaryRejectedProbeTypes.has(error.type)
    )
      return;

    const name = error instanceof AuthError ? error.type : error.name;
    console.error(`[auth][error] ${name}: ${error.message}`);

    const cause = error.cause;
    if (cause && typeof cause === "object" && "err" in cause) {
      const { err, ...data } = cause as { err: unknown };
      if (err instanceof Error) console.error("[auth][cause]:", err.stack);
      console.error("[auth][details]:", JSON.stringify(data, null, 2));
    } else if (error.stack) {
      console.error(error.stack.replace(/.*/, "").substring(1));
    }
  },
};
