import type { TRPCError } from "@trpc/server";

/**
 * tRPC error codes that map to 4xx client errors. These are expected outcomes
 * (missing resource, bad input, unauthorized), not bugs, so they should not be
 * reported to Sentry.
 */
export const EXPECTED_TRPC_CODES: readonly TRPCError["code"][] = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
];

export function isExpectedTRPCErrorCode(code: TRPCError["code"]): boolean {
  return EXPECTED_TRPC_CODES.includes(code);
}

/**
 * Duck-typed guard for Sentry's `beforeSend`. Matches on the error name + code
 * rather than `instanceof TRPCError`: the thrown error comes from the app
 * bundle, whose `@trpc/server` class identity differs from the copy an
 * instrumentation config would import at runtime, so `instanceof` gives false
 * negatives.
 */
export function isExpectedTRPCError(err: unknown): err is TRPCError {
  return (
    err instanceof Error &&
    err.name === "TRPCError" &&
    isExpectedTRPCErrorCode((err as TRPCError).code)
  );
}

/**
 * tRPC route-handler `onError`. Logs genuine server errors but drops expected
 * client errors, so Sentry's `captureConsoleIntegration` never reports them.
 */
export function createTRPCOnError(label: string) {
  return ({ error }: { error: Pick<TRPCError, "code" | "message"> }) => {
    if (isExpectedTRPCErrorCode(error.code)) return;
    console.log(`Error in tRPC handler (${label})`);
    console.error(error);
  };
}
