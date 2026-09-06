import { db as defaultDb } from "@openstatus/db";
import { oauthClient } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { InternalServiceError } from "../errors";
import { GRANT_TYPES, RESPONSE_TYPES } from "./constants";
import { randomHex } from "./crypto";
import { OAuthError } from "./errors";
import { isAllowedRedirectUri } from "./redirect-allowlist";
import { RegisterClientInput } from "./schemas";

export type RegisteredClient = {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
};

/** RFC 7591 dynamic registration. Public clients only; every redirect URI must pass the allowlist. */
export async function registerClient(args: {
  input: RegisterClientInput;
  db?: DB;
}): Promise<RegisteredClient> {
  const parsed = RegisterClientInput.safeParse(args.input);
  if (!parsed.success) {
    throw new OAuthError(
      "invalid_client_metadata",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }
  const input = parsed.data;
  const db = args.db ?? defaultDb;

  const redirectUris = Array.from(new Set(input.redirect_uris));
  const rejected = redirectUris.filter((uri) => !isAllowedRedirectUri(uri));
  if (rejected.length > 0) {
    throw new OAuthError(
      "invalid_redirect_uri",
      `redirect_uris must target an allowlisted host, a loopback address or a supported app scheme. Rejected: ${rejected.join(", ")}`,
    );
  }

  const [row] = await db
    .insert(oauthClient)
    .values({
      clientId: randomHex(16),
      name: input.client_name ?? "MCP Client",
      redirectUris,
    })
    .returning();
  if (!row) throw new InternalServiceError("Failed to register client");

  return {
    client_id: row.clientId,
    client_id_issued_at: Math.floor(
      (row.createdAt ?? new Date()).getTime() / 1000,
    ),
    client_name: row.name,
    redirect_uris: row.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: [...GRANT_TYPES],
    response_types: [...RESPONSE_TYPES],
  };
}
