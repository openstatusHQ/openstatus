import { isTRPCClientError } from "@trpc/client";

/** What to show for a failed call: the server's message, else `fallback`. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  return isTRPCClientError(error) ? error.message : fallback;
}
