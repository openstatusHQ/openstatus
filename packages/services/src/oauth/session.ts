import { db as defaultDb, eq } from "@openstatus/db";
import {
  type OAuthSession,
  oauthClient,
  oauthSession,
  selectOAuthSessionSchema,
} from "@openstatus/db/src/schema";
import type { SettableScope } from "@openstatus/db/src/schema/api-keys/constants";

import type { DB } from "../context";
import {
  InternalServiceError,
  NotFoundError,
  PreconditionFailedError,
} from "../errors";
import {
  type ClientMetadataFetcher,
  isUrlClientId,
  resolveUrlClient,
} from "./cimd";
import { SESSION_TTL_MS } from "./constants";
import { randomBase64Url } from "./crypto";
import { OAuthError } from "./errors";
import { getLiveClient } from "./internal";
import { matchesRegisteredRedirectUri } from "./redirect-allowlist";
import {
  CreateSessionInput,
  GetSessionInput,
  MAX_STATE_LENGTH,
  parseScopeParam,
} from "./schemas";

/**
 * Validate an authorize request and persist it as a pending session. Client
 * and redirect URI failures throw without a redirect target; everything after
 * that carries the redirect so the route can send the error back per RFC 6749.
 */
export async function createSession(args: {
  input: CreateSessionInput;
  db?: DB;
  now?: Date;
  /** Overrides the network fetch for URL client ids; tests inject a stub. */
  fetchClientMetadata?: ClientMetadataFetcher;
}): Promise<{ id: string }> {
  const input = CreateSessionInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();

  if (!input.client_id) {
    throw new OAuthError("invalid_request", "client_id is required");
  }
  const client = isUrlClientId(input.client_id)
    ? await resolveUrlClient(db, input.client_id, args.fetchClientMetadata)
    : await getLiveClient(db, input.client_id);

  if (!input.redirect_uri) {
    throw new OAuthError("invalid_request", "redirect_uri is required");
  }
  if (!matchesRegisteredRedirectUri(client.redirectUris, input.redirect_uri)) {
    throw new OAuthError(
      "invalid_redirect_uri",
      "redirect_uri does not match a registered redirect URI",
    );
  }
  // From here on the redirect target is trusted; the state itself is checked
  // last so an oversized one still travels back (truncated) to the client.
  const redirect = {
    redirectUri: input.redirect_uri,
    state: input.state?.slice(0, MAX_STATE_LENGTH),
  };

  if (input.response_type !== "code") {
    throw new OAuthError(
      "unsupported_response_type",
      "response_type must be 'code'",
      redirect,
    );
  }
  if (!input.code_challenge) {
    throw new OAuthError(
      "invalid_request",
      "code_challenge is required (PKCE)",
      redirect,
    );
  }
  if (input.code_challenge_method !== "S256") {
    throw new OAuthError(
      "invalid_request",
      "code_challenge_method must be 'S256'",
      redirect,
    );
  }
  const { scopes, invalid } = parseScopeParam(input.scope);
  if (invalid.length > 0) {
    throw new OAuthError(
      "invalid_scope",
      `Unknown scope: ${invalid.join(", ")}`,
      redirect,
    );
  }
  if (
    input.resource !== undefined &&
    input.expectedResource !== undefined &&
    input.resource !== input.expectedResource
  ) {
    throw new OAuthError(
      "invalid_target",
      `resource must be ${input.expectedResource}`,
      redirect,
    );
  }
  if (input.state !== undefined && input.state.length > MAX_STATE_LENGTH) {
    throw new OAuthError(
      "invalid_request",
      `state must be at most ${MAX_STATE_LENGTH} characters`,
      redirect,
    );
  }

  const id = randomBase64Url(32);
  const [row] = await db
    .insert(oauthSession)
    .values({
      id,
      clientId: client.clientId,
      redirectUri: input.redirect_uri,
      scope: scopes,
      state: input.state ?? null,
      resource: input.resource ?? null,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    })
    .returning({ id: oauthSession.id });
  if (!row) throw new InternalServiceError("Failed to create OAuth session");
  return { id: row.id };
}

/** The one definition of "still answerable": exists, undecided, unexpired. */
export async function loadPendingSession(
  db: DB,
  id: string,
  now: Date,
): Promise<OAuthSession> {
  const raw = await db
    .select()
    .from(oauthSession)
    .where(eq(oauthSession.id, id))
    .get();
  if (!raw) throw new NotFoundError("oauth_session");
  const session = selectOAuthSessionSchema.parse(raw);
  if (session.decidedAt) {
    throw new PreconditionFailedError(
      "This authorization request was already answered",
    );
  }
  if (session.expiresAt < now) {
    throw new PreconditionFailedError("This authorization request expired");
  }
  return session;
}

export type PendingSession = {
  id: string;
  clientId: string;
  clientName: string;
  scope: SettableScope[];
  expiresAt: Date;
};

/** Consent-page read. Throws once the session expired or was decided. */
export async function getSession(args: {
  input: GetSessionInput;
  db?: DB;
  now?: Date;
}): Promise<PendingSession> {
  const input = GetSessionInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();

  const session = await loadPendingSession(db, input.id, now);
  const client = await db
    .select({ clientId: oauthClient.clientId, name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, session.clientId))
    .get();
  if (!client) throw new NotFoundError("oauth_client", session.clientId);

  return {
    id: session.id,
    clientId: client.clientId,
    clientName: client.name,
    scope: session.scope,
    expiresAt: session.expiresAt,
  };
}
