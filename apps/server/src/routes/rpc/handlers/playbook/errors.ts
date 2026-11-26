import { Code, ConnectError } from "@connectrpc/connect";

export const ErrorReason = {
  PLAYBOOK_NOT_FOUND: "PLAYBOOK_NOT_FOUND",
  INVALID_ENUM: "INVALID_ENUM",
} as const;

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason];

const DOMAIN = "openstatus.dev";

function createError(
  message: string,
  code: Code,
  reason: ErrorReason,
  metadata?: Record<string, string>,
): ConnectError {
  const headers = new Headers({
    "error-domain": DOMAIN,
    "error-reason": reason,
  });
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      headers.set(`error-${key}`, value);
    }
  }
  return new ConnectError(message, code, headers);
}

export function playbookNotFoundError(type: string): ConnectError {
  return createError(
    `The workspace has no ${type} playbook`,
    Code.NotFound,
    ErrorReason.PLAYBOOK_NOT_FOUND,
    { "playbook-type": type },
  );
}

export function invalidPlaybookTypeError(): ConnectError {
  return createError(
    "Invalid playbook type",
    Code.InvalidArgument,
    ErrorReason.INVALID_ENUM,
    { field: "type" },
  );
}
