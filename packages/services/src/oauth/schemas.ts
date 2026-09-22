import {
  type Scope,
  type SettableScope,
  apiKeySettableScopes,
} from "@openstatus/db/src/schema/api-keys/constants";
import { oauthScopesSchema } from "@openstatus/db/src/schema/oauth/validation";
import { z } from "zod";

import {
  DEFAULT_SCOPE,
  GRANT_TYPES,
  RESPONSE_TYPES,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from "./constants";

/**
 * Space-delimited RFC 6749 scope string to the stored array. Read+write
 * collapses to `["write"]` because `matchesScope` treats write as implying
 * read; an absent parameter means write.
 */
export function parseScopeParam(scope: string | undefined | null): {
  scopes: SettableScope[];
  invalid: string[];
} {
  const parts = (scope ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { scopes: [...DEFAULT_SCOPE], invalid: [] };
  const invalid = parts.filter(
    (p) => !(apiKeySettableScopes as readonly string[]).includes(p),
  );
  if (invalid.length > 0) return { scopes: [], invalid };
  return { scopes: parts.includes("write") ? ["write"] : ["read"], invalid };
}

// Grants never store '*'; it is folded into write defensively.
export function normalizeScopes(scopes: readonly Scope[]): SettableScope[] {
  return scopes.includes("write") || scopes.includes("*")
    ? ["write"]
    : ["read"];
}

export function formatScope(scopes: readonly Scope[]): string {
  return normalizeScopes(scopes).join(" ");
}

export const RegisterClientInput = z.object({
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(z.string().min(1)).min(1).max(10),
  token_endpoint_auth_method: z
    .enum(TOKEN_ENDPOINT_AUTH_METHODS, {
      message:
        "Only public clients (token_endpoint_auth_method 'none') are supported",
    })
    .optional(),
  grant_types: z.array(z.enum(GRANT_TYPES)).optional(),
  response_types: z.array(z.enum(RESPONSE_TYPES)).optional(),
});
export type RegisterClientInput = z.input<typeof RegisterClientInput>;

// Loose on purpose: `createSession` decides per field whether the failure
// is a 400 or an error redirect, so zod must not reject early.
export const CreateSessionInput = z.object({
  response_type: z.string().optional(),
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  /** `<issuer>/mcp`; a `resource` parameter must equal it when present. */
  expectedResource: z.string().optional(),
});
export type CreateSessionInput = z.input<typeof CreateSessionInput>;

export const MAX_STATE_LENGTH = 1024;

export const GetSessionInput = z.object({ id: z.string().min(1) });
export type GetSessionInput = z.infer<typeof GetSessionInput>;

export const DecideSessionInput = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
  userId: z.number().int(),
  workspaceId: z.number().int().optional(),
  scope: oauthScopesSchema.optional(),
});
export type DecideSessionInput = z.infer<typeof DecideSessionInput>;

export const ExchangeCodeInput = z.object({
  clientId: z.string().min(1),
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().min(1),
});
export type ExchangeCodeInput = z.infer<typeof ExchangeCodeInput>;

export const RefreshGrantInput = z.object({
  clientId: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type RefreshGrantInput = z.infer<typeof RefreshGrantInput>;

export const RevokeTokenInput = z.object({
  clientId: z.string().min(1),
  token: z.string().min(1),
});
export type RevokeTokenInput = z.infer<typeof RevokeTokenInput>;

export const RevokeGrantInput = z.object({ grantId: z.number().int() });
export type RevokeGrantInput = z.infer<typeof RevokeGrantInput>;

export const TokenResponse = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  expires_in: z.number().int(),
  refresh_token: z.string(),
  scope: z.string(),
});
export type TokenResponse = z.infer<typeof TokenResponse>;
