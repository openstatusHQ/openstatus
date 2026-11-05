import { isTRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";

/** What to show for a failed call: the server's message, else `fallback`. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  return isTRPCClientError(error) ? error.message : fallback;
}

/** A NOT_FOUND from the browser client (`TRPCClientError`) or a server prefetch (`TRPCError`). */
export function isNotFound(error: unknown) {
  if (error instanceof TRPCError) return error.code === "NOT_FOUND";
  return isTRPCClientError(error) && error.data?.code === "NOT_FOUND";
}

/** A 404 the caller opted into (`expectNotFound`): a reference to a deleted entity, not a bug. */
export function isExpectedNotFound(error: unknown, expected: unknown) {
  return expected === true && isNotFound(error);
}
