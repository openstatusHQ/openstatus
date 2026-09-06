import { and, eq, isNull } from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthSession,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import {
  ForbiddenError,
  PreconditionFailedError,
  ValidationError,
} from "../errors";
import { getMembership } from "../member/membership";
import { CODE_TTL_MS } from "./constants";
import { randomBase64Url, sha256Hex } from "./crypto";
import { runTx } from "./internal";
import { DecideSessionInput, normalizeScopes } from "./schemas";
import { loadPendingSession } from "./session";

/** `state` is opaque and echoed whenever the client sent one, even empty. */
function buildRedirect(
  redirectUri: string,
  params: Record<string, string>,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (state !== null) url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Consent decision. Approve checks workspace membership, allows narrowing the
 * requested scope, mints a ten-minute single-use code and returns the client
 * redirect; deny returns the `access_denied` redirect. Either way the session
 * is spent.
 */
export async function decideSession(args: {
  input: DecideSessionInput;
  db?: DB;
  now?: Date;
}): Promise<{ redirectUrl: string }> {
  const input = DecideSessionInput.parse(args.input);
  const now = args.now ?? new Date();

  return runTx(args.db, async (tx) => {
    const session = await loadPendingSession(tx, input.id, now);

    // The atomic update is the race guard; `loadPendingSession` only
    // produces the friendlier error for the common case.
    const [decided] = await tx
      .update(oauthSession)
      .set({ decidedAt: now })
      .where(and(eq(oauthSession.id, input.id), isNull(oauthSession.decidedAt)))
      .returning({ id: oauthSession.id });
    if (!decided) {
      throw new PreconditionFailedError(
        "This authorization request was already answered",
      );
    }

    if (!input.approved) {
      return {
        redirectUrl: buildRedirect(
          session.redirectUri,
          { error: "access_denied" },
          session.state,
        ),
      };
    }

    if (input.workspaceId === undefined) {
      throw new ValidationError("workspaceId is required to approve");
    }
    if (!(await getMembership(tx, input.userId, input.workspaceId))) {
      throw new ForbiddenError("You are not a member of that workspace");
    }

    const granted = normalizeScopes(input.scope ?? session.scope);
    const requestedWrite = session.scope.includes("write");
    if (granted.includes("write") && !requestedWrite) {
      throw new ValidationError("Granted scope exceeds the requested scope");
    }

    const code = randomBase64Url(32);
    await tx.insert(oauthAuthorizationCode).values({
      hash: await sha256Hex(code),
      clientId: session.clientId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      scope: granted,
      redirectUri: session.redirectUri,
      codeChallenge: session.codeChallenge,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });

    return {
      redirectUrl: buildRedirect(session.redirectUri, { code }, session.state),
    };
  });
}
