import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { type ServiceContext, ServiceError } from "@openstatus/services";

import type { Context } from "./trpc";

type AuthedContext = Context & {
  user: { id: number };
  workspace: NonNullable<Context["workspace"]>;
};

/**
 * Translate a tRPC `protectedProcedure` context into a `ServiceContext`.
 * Workspace + actor come from the authed middleware output; `requestId` is
 * best-effort from upstream headers.
 */
export function toServiceCtx(ctx: AuthedContext): ServiceContext {
  return {
    workspace: ctx.workspace,
    actor: { type: "user", userId: ctx.user.id },
    requestId: ctx.req?.headers.get("x-request-id") ?? undefined,
  };
}

/**
 * Map any error thrown by a service call to a `TRPCError`. `ZodError`
 * bubbles up unchanged so tRPC's `errorFormatter` can surface field-level
 * issues as-is. Internal errors carry the cause for Sentry/logtape but do
 * not leak it in the user-facing `message`.
 */
export function toTRPCError(err: unknown): never {
  if (err instanceof TRPCError) throw err;
  if (err instanceof ZodError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid input",
      cause: err,
    });
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
        throw new TRPCError({ code: "NOT_FOUND", message: err.message });
      case "FORBIDDEN":
        throw new TRPCError({ code: "FORBIDDEN", message: err.message });
      case "UNAUTHORIZED":
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.message });
      case "CONFLICT":
        throw new TRPCError({ code: "CONFLICT", message: err.message });
      case "VALIDATION":
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message,
          cause: err.cause,
        });
      case "LIMIT_EXCEEDED":
        // Quota exhaustion semantically maps to TOO_MANY_REQUESTS (429),
        // not FORBIDDEN (403). Mirrors the Connect adapter's
        // Code.ResourceExhausted mapping — both surfaces should say
        // "you've hit a plan quota" rather than "you can't do this."
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: err.message,
        });
      case "PRECONDITION_FAILED":
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err.message,
        });
      case "INTERNAL":
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
          cause: err.cause,
        });
    }
  }
  // Unknown errors: never surface raw `err.message` to clients — it can
  // leak DB strings, stack-trace fragments, third-party SDK internals.
  // Keep the original on `cause` for Sentry/log redaction.
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    cause: err,
  });
}
