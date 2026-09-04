import { AuthError } from "@auth/core/errors";
import type { LoggerInstance } from "@auth/core/types";

/**
 * Auth.js' default logger, minus `UnknownAction`: scanners probing
 * `/api/auth/<anything>` already get a 400, and each probe would otherwise
 * reach Sentry as a new issue via captureConsoleIntegration.
 */
export const logger: Partial<LoggerInstance> = {
  error(error) {
    if (error instanceof AuthError && error.type === "UnknownAction") return;

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
