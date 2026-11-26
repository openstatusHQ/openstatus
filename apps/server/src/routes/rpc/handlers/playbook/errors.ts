import { Code, ConnectError } from "@connectrpc/connect";

export const ErrorReason = {
  PLAYBOOK_NOT_FOUND: "PLAYBOOK_NOT_FOUND",
  INVALID_SLUG: "INVALID_SLUG",
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

export function playbookNotFoundError(slug: string): ConnectError {
  return createError(
    `The workspace has no ${slug} playbook`,
    Code.NotFound,
    ErrorReason.PLAYBOOK_NOT_FOUND,
    { "playbook-slug": slug },
  );
}

export function invalidPlaybookSlugError(slug: string): ConnectError {
  return createError(
    `Unknown playbook slug "${slug}"`,
    Code.InvalidArgument,
    ErrorReason.INVALID_SLUG,
    { field: "slug" },
  );
}
