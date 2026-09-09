import { db, eq } from "@openstatus/db";
import {
  apiKey,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import type { Scope, Workspace } from "@openstatus/db/src/schema";
import { verifyApiKeyHash } from "@openstatus/db/src/utils/api-key";
import { retryRead } from "@openstatus/services";
import { Effect } from "effect";

import { AuthError } from "../errors";

export type Authenticated = {
  workspace: Workspace;
  keyId: string;
  scopes: Scope[];
};

/** `x-openstatus-key`, then `Authorization: Bearer`, then `?key=`. */
export function extractKey(req: Request): string | null {
  const header = req.headers.get("x-openstatus-key");
  if (header) return header;

  const authorization = req.headers.get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    if (match?.[1]) return match[1];
  }

  // Query fallback for senders that cannot set custom headers. Must be redacted
  // from every log line — see `redactKey`.
  const url = new URL(req.url);
  return url.searchParams.get("key");
}

export function redactKey(url: string): string {
  return url.replace(/([?&]key=)[^&]*/gi, "$1REDACTED");
}

export const authenticate = Effect.fn("authenticate")(function* (req: Request) {
  const token = extractKey(req);
  if (!token) {
    return yield* new AuthError({ reason: "missing credentials" });
  }

  const prefix = token.slice(0, 11);
  const row = yield* Effect.tryPromise({
    try: () =>
      retryRead(() =>
        db.select().from(apiKey).where(eq(apiKey.prefix, prefix)).get(),
      ),
    catch: () => new AuthError({ reason: "key lookup failed" }),
  });

  if (!row) return yield* new AuthError({ reason: "unknown key" });

  const valid = yield* Effect.tryPromise({
    try: () => verifyApiKeyHash(token, row.hashedToken),
    catch: () => new AuthError({ reason: "key verification failed" }),
  });
  if (!valid) return yield* new AuthError({ reason: "unknown key" });

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return yield* new AuthError({ reason: "key expired" });
  }

  const workspaceRow = yield* Effect.tryPromise({
    try: () =>
      retryRead(() =>
        db
          .select()
          .from(workspace)
          .where(eq(workspace.id, row.workspaceId))
          .get(),
      ),
    catch: () => new AuthError({ reason: "workspace lookup failed" }),
  });
  if (!workspaceRow)
    return yield* new AuthError({ reason: "workspace missing" });

  const parsed = selectWorkspaceSchema.safeParse(workspaceRow);
  if (!parsed.success) {
    return yield* new AuthError({ reason: "workspace invalid" });
  }

  return {
    workspace: parsed.data,
    keyId: String(row.id),
    scopes: row.scopes,
  } satisfies Authenticated;
});
