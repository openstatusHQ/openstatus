import { isTRPCClientError } from "@trpc/client";

/** What to show for a failed call: the server's message, else `fallback`. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  return isTRPCClientError(error) ? error.message : fallback;
}

/** A 404 the caller opted into (`expectNotFound`): a reference to a deleted entity, not a bug. */
export function isExpectedNotFound(error: unknown, expected: unknown) {
  return (
    expected === true &&
    isTRPCClientError(error) &&
    error.data?.code === "NOT_FOUND"
  );
}
