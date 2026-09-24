import type { MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { errorToJson } from "@connectrpc/connect/protocol-connect";
import { type ErrorCode, ErrorCodes, errorDocsUrl } from "@openstatus/error";
import {
  BadRequestSchema,
  ErrorInfoSchema,
  RetryInfoSchema,
} from "@openstatus/proto/google/rpc";

export const ERROR_DOMAIN = "openstatus.dev";

/**
 * Stable, machine-readable reasons carried in `google.rpc.ErrorInfo.reason`.
 * The generic ones share their name with the v1 REST error code so one docs
 * anchor serves both surfaces.
 */
export const ErrorReason = {
  // Generic (one per Connect code / v1 code)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  // Authentication
  MISSING_CREDENTIALS: "MISSING_CREDENTIALS",
  INVALID_API_KEY: "INVALID_API_KEY",
  // Validation
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_REGION: "INVALID_REGION",
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_CUSTOM_DOMAIN: "INVALID_CUSTOM_DOMAIN",
  INVALID_ICON_URL: "INVALID_ICON_URL",
  INVALID_MONITOR_ID: "INVALID_MONITOR_ID",
  INVALID_NOTIFICATION_DATA: "INVALID_NOTIFICATION_DATA",
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  AUTH_EMAIL_DOMAINS_REQUIRED: "AUTH_EMAIL_DOMAINS_REQUIRED",
  IDENTIFIER_REQUIRED: "IDENTIFIER_REQUIRED",
  MONITOR_TYPE_MISMATCH: "MONITOR_TYPE_MISMATCH",
  PROVIDER_NOT_SUPPORTED: "PROVIDER_NOT_SUPPORTED",
  // Plan
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  PLAN_FEATURE_NOT_AVAILABLE: "PLAN_FEATURE_NOT_AVAILABLE",
  // Resources
  MONITOR_NOT_FOUND: "MONITOR_NOT_FOUND",
  RESPONSE_LOG_NOT_FOUND: "RESPONSE_LOG_NOT_FOUND",
  NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
  STATUS_PAGE_NOT_FOUND: "STATUS_PAGE_NOT_FOUND",
  STATUS_PAGE_NOT_PUBLISHED: "STATUS_PAGE_NOT_PUBLISHED",
  STATUS_PAGE_ACCESS_DENIED: "STATUS_PAGE_ACCESS_DENIED",
  SLUG_ALREADY_EXISTS: "SLUG_ALREADY_EXISTS",
  PAGE_COMPONENT_NOT_FOUND: "PAGE_COMPONENT_NOT_FOUND",
  COMPONENT_GROUP_NOT_FOUND: "COMPONENT_GROUP_NOT_FOUND",
  SUBSCRIBER_NOT_FOUND: "SUBSCRIBER_NOT_FOUND",
  STATUS_REPORT_NOT_FOUND: "STATUS_REPORT_NOT_FOUND",
  MAINTENANCE_NOT_FOUND: "MAINTENANCE_NOT_FOUND",
  PRIVATE_LOCATION_NOT_FOUND: "PRIVATE_LOCATION_NOT_FOUND",
  // Delivery
  TEST_NOTIFICATION_FAILED: "TEST_NOTIFICATION_FAILED",
} as const;

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason];

type OutgoingDetail = NonNullable<
  ConstructorParameters<typeof ConnectError>[3]
>[number];
type ErrorInfoInit = MessageInitShape<typeof ErrorInfoSchema>;

export type FieldViolation = { field: string; description: string };

export type RpcErrorInit = {
  code: Code;
  reason: ErrorReason;
  message: string;
  /** Extra `ErrorInfo.metadata` entries, lowerCamelCase keys. */
  metadata?: Record<string, string>;
  /** Attaches `google.rpc.RetryInfo`. */
  retryAfterSeconds?: number;
  /** Attaches `google.rpc.BadRequest`. */
  fieldViolations?: FieldViolation[];
  cause?: unknown;
};

/** The one way to build a ConnectError in this server: every error carries `google.rpc.ErrorInfo`. */
export function rpcError(init: RpcErrorInit): ConnectError {
  const details: OutgoingDetail[] = [
    {
      desc: ErrorInfoSchema,
      value: {
        reason: init.reason,
        domain: ERROR_DOMAIN,
        metadata: { ...init.metadata },
      },
    },
  ];
  if (init.retryAfterSeconds !== undefined) {
    details.push({
      desc: RetryInfoSchema,
      value: {
        retryDelay: {
          seconds: BigInt(Math.max(1, Math.ceil(init.retryAfterSeconds))),
          nanos: 0,
        },
      },
    });
  }
  if (init.fieldViolations?.length) {
    details.push({
      desc: BadRequestSchema,
      value: { fieldViolations: init.fieldViolations },
    });
  }
  return new ConnectError(
    init.message,
    init.code,
    undefined,
    details,
    init.cause,
  );
}

export const ERROR_CODE_TO_CONNECT: Record<ErrorCode, Code> = {
  BAD_REQUEST: Code.InvalidArgument,
  UNAUTHORIZED: Code.Unauthenticated,
  PAYMENT_REQUIRED: Code.ResourceExhausted,
  FORBIDDEN: Code.PermissionDenied,
  NOT_FOUND: Code.NotFound,
  METHOD_NOT_ALLOWED: Code.Unimplemented,
  CONFLICT: Code.AlreadyExists,
  UNPROCESSABLE_ENTITY: Code.InvalidArgument,
  TOO_MANY_REQUESTS: Code.ResourceExhausted,
  INTERNAL_SERVER_ERROR: Code.Internal,
  SERVICE_UNAVAILABLE: Code.Unavailable,
};

/** Inverse of `ERROR_CODE_TO_CONNECT`; picks the v1 code whose docs section applies. */
export function connectCodeToErrorCode(code: Code): ErrorCode {
  switch (code) {
    case Code.InvalidArgument:
    case Code.OutOfRange:
      return "BAD_REQUEST";
    case Code.Unauthenticated:
      return "UNAUTHORIZED";
    case Code.PermissionDenied:
      return "FORBIDDEN";
    case Code.NotFound:
      return "NOT_FOUND";
    case Code.AlreadyExists:
    case Code.Aborted:
      return "CONFLICT";
    case Code.FailedPrecondition:
      return "UNPROCESSABLE_ENTITY";
    case Code.ResourceExhausted:
      return "TOO_MANY_REQUESTS";
    case Code.Unimplemented:
      return "METHOD_NOT_ALLOWED";
    case Code.Unavailable:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

const V1_CODES: ReadonlySet<string> = new Set(ErrorCodes);

/** A v1 reason names its own docs section; the Connect code is lossy (402 and 429 both map to ResourceExhausted). */
function docsFor(err: ConnectError, reason?: string): string {
  const code =
    reason && V1_CODES.has(reason)
      ? (reason as ErrorCode)
      : connectCodeToErrorCode(err.code);
  return errorDocsUrl(code);
}

function findErrorInfo(err: ConnectError): ErrorInfoInit | undefined {
  for (const detail of err.details) {
    if ("desc" in detail && detail.desc.typeName === ErrorInfoSchema.typeName) {
      return detail.value as ErrorInfoInit;
    }
  }
  return undefined;
}

/**
 * Backfills `requestId` and `docs` on the ErrorInfo, adding one with a generic
 * reason when a handler threw a bare ConnectError. Mutates in place so the
 * error identity (and its cause) survives.
 */
export function withErrorInfo(
  err: ConnectError,
  requestId?: string,
): ConnectError {
  const info = findErrorInfo(err);
  const base: Record<string, string> = { docs: docsFor(err, info?.reason) };
  if (requestId) base.requestId = requestId;

  if (info) {
    info.metadata = { ...base, ...info.metadata };
    return err;
  }
  err.details.push({
    desc: ErrorInfoSchema,
    value: {
      reason: connectCodeToErrorCode(err.code),
      domain: ERROR_DOMAIN,
      metadata: base,
    },
  });
  return err;
}

/**
 * Wire shape of a Connect unary error, for responses written outside the
 * Connect router. Typed loosely on purpose: Hono's `c.json` recurses over the
 * protobuf `JsonValue` type and trips TS2589.
 */
export function connectErrorToJson(err: ConnectError): Record<string, unknown> {
  return errorToJson(err, undefined);
}
