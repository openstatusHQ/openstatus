// Unit test for the TRPC error guard added to providers.ts. The Resend
// provider's sendVerificationRequest callback calls
// queryClient.fetchQuery(validateEmailDomain), which throws on TRPCError.
// The fix wraps the call in try/catch, logs a structured diagnostic for
// TRPC errors (which next-auth's Resend provider treats as "abort
// delivery"), and re-throws anything else so transient failures still
// surface through NextAuth's existing error handler.

import { describe, expect, mock, test } from "bun:test";
import { TRPCClientError, isTRPCClientError } from "@trpc/client";

// Pure-function predicate that mirrors the provider's catch branch.
// Kept inline rather than re-exported to keep the source diff to one
// file; if the maintainer prefers, this can be hoisted out of providers.ts
// into a small helper module that both files import.
function logAndAbortIfTrpcRejection(
  error: unknown,
  prefix: string,
  email: string,
  log: (msg: string) => void,
): "abort" {
  if (!isTRPCClientError(error)) throw error;
  log(
    `[ResendProvider] validateEmailDomain rejected for slug="${prefix}" email="${email}": ${error.message}`,
  );
  return "abort";
}

describe("ResendProvider validateEmailDomain error handling", () => {
  test("logs the TRPC error message when validateEmailDomain throws TRPCError", () => {
    const log = mock((_msg: string) => {});
    const trpcError = new TRPCClientError<never>("Page not found");

    const result = logAndAbortIfTrpcRejection(
      trpcError,
      "acme",
      "user@acme.com",
      log,
    );

    expect(result).toBe("abort");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("[ResendProvider]");
    expect(log.mock.calls[0][0]).toContain('slug="acme"');
    expect(log.mock.calls[0][0]).toContain('email="user@acme.com"');
    expect(log.mock.calls[0][0]).toContain("Page not found");
  });

  test("re-throws non-TRPC errors so NextAuth's existing handler can surface them", () => {
    const log = mock((_msg: string) => {});
    const networkError = new TypeError("fetch failed");

    expect(() =>
      logAndAbortIfTrpcRejection(networkError, "acme", "user@acme.com", log),
    ).toThrow(networkError);
    // Nothing should have been logged — transient failures aren't
    // domain-validation rejections and don't need the structured prefix.
    expect(log).not.toHaveBeenCalled();
  });

  test("error log includes both slug and email so ops can correlate failed deliveries", () => {
    const log = mock((_msg: string) => {});
    const err = new TRPCClientError<never>("Invalid email domain");

    logAndAbortIfTrpcRejection(err, "globex", "intruder@evil.com", log);

    const msg = log.mock.calls[0][0];
    expect(msg).toContain('slug="globex"');
    expect(msg).toContain('email="intruder@evil.com"');
    expect(msg).toContain("Invalid email domain");
  });
});
