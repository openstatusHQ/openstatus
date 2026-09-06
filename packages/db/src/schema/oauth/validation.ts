import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { apiKeySettableScopes } from "../api-keys/constants";
import { oauthAuthorizationCode } from "./oauth_authorization_code";
import { oauthClient } from "./oauth_client";
import { oauthGrant } from "./oauth_grant";
import { oauthSession } from "./oauth_session";

// Grants never carry '*': that scope is synthesized by middleware only.
export const oauthScopesSchema = z.array(z.enum(apiKeySettableScopes)).min(1);

export const selectOAuthClientSchema = createSelectSchema(oauthClient, {
  redirectUris: z.array(z.string()),
});
export const selectOAuthSessionSchema = createSelectSchema(oauthSession, {
  scope: oauthScopesSchema,
});
export const selectOAuthAuthorizationCodeSchema = createSelectSchema(
  oauthAuthorizationCode,
  { scope: oauthScopesSchema },
);
export const selectOAuthGrantSchema = createSelectSchema(oauthGrant, {
  scope: oauthScopesSchema,
});

export type OAuthClient = z.infer<typeof selectOAuthClientSchema>;
export type OAuthSession = z.infer<typeof selectOAuthSessionSchema>;
export type OAuthAuthorizationCode = z.infer<
  typeof selectOAuthAuthorizationCodeSchema
>;
export type OAuthGrant = z.infer<typeof selectOAuthGrantSchema>;
