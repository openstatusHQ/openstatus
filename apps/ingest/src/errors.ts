import { Schema } from "effect";

export class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
  reason: Schema.String,
}) {}

export class PayloadTooLargeError extends Schema.TaggedError<PayloadTooLargeError>()(
  "PayloadTooLargeError",
  { limitBytes: Schema.Number },
) {}

export class RateLimitedError extends Schema.TaggedError<RateLimitedError>()(
  "RateLimitedError",
  { retryAfterSeconds: Schema.Number },
) {}

export class AdapterError extends Schema.TaggedError<AdapterError>()(
  "AdapterError",
  { adapterId: Schema.String, cause: Schema.String },
) {}

export class SchemaError extends Schema.TaggedError<SchemaError>()(
  "SchemaError",
  { field: Schema.String, cause: Schema.String },
) {}

export class DbError extends Schema.TaggedError<DbError>()("DbError", {
  cause: Schema.String,
  retryable: Schema.Boolean,
}) {}

export class PlanLimitError extends Schema.TaggedError<PlanLimitError>()(
  "PlanLimitError",
  { limit: Schema.String },
) {}

export class WorkspaceError extends Schema.TaggedError<WorkspaceError>()(
  "WorkspaceError",
  { reason: Schema.String },
) {}

export type IngestError =
  | AuthError
  | PayloadTooLargeError
  | RateLimitedError
  | AdapterError
  | SchemaError
  | DbError
  | PlanLimitError
  | WorkspaceError;

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
