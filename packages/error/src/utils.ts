import type { ZodIssue } from "zod";

import type { ErrorCode } from "./error-code";

export function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 402:
      return "PAYMENT_REQUIRED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 500:
      return "INTERNAL_SERVER_ERROR";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

export function codeToStatus(code: ErrorCode) {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "PAYMENT_REQUIRED":
      return 402;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "CONFLICT":
      return 409;
    case "UNPROCESSABLE_ENTITY":
      return 422;
    case "INTERNAL_SERVER_ERROR":
      return 500;
    default:
      return 500;
  }
}

// Props to cal.com: https://github.com/calcom/cal.com/blob/5d325495a9c30c5a9d89fc2adfa620b8fde9346e/packages/lib/server/getServerErrorFromUnknown.ts#L17
export function parseZodErrorIssues(issues: ZodIssue[]): string {
  return issues
    .map((i) =>
      i.code === "invalid_union"
        ? i.unionErrors.map((ue) => parseZodErrorIssues(ue.issues)).join("; ")
        : i.code === "unrecognized_keys"
          ? i.message
          : `${i.path.length ? `${i.code} in '${i.path}': ` : ""}${i.message}`,
    )
    .join("; ");
}

export function redactError<TError extends Error | unknown>(err: TError) {
  if (!(err instanceof Error)) return err;
  console.error(`Type of Error: ${err.constructor}`);
}
