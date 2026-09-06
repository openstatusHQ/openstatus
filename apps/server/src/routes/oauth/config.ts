import {
  type ClientMetadataFetcher,
  resourceMetadataUrl as metadataUrl,
} from "@openstatus/services/oauth";

import { env } from "@/env";

export type OAuthConfig = {
  /** Origin of the authorization server and the `/mcp` resource, no trailing slash. */
  issuer: string;
  /** Origin of the dashboard that serves `/oauth/consent`, no trailing slash. */
  dashboardUrl: string;
  /** URL client id resolver; production leaves it unset, tests stub it. */
  fetchClientMetadata?: ClientMetadataFetcher;
};

const trimSlash = (url: string) => url.replace(/\/+$/, "");

// `skipValidation` in env.ts means zod defaults never apply; resolve them here.
export function oauthConfigFromEnv(): OAuthConfig {
  const production = env.NODE_ENV === "production";
  return {
    issuer: trimSlash(
      env.OAUTH_ISSUER ??
        (production ? "https://api.openstatus.dev" : "http://localhost:3000"),
    ),
    dashboardUrl: trimSlash(
      env.DASHBOARD_URL ??
        (production ? "https://app.openstatus.dev" : "http://localhost:3001"),
    ),
  };
}

export function resourceMetadataUrl(config: OAuthConfig): string {
  return metadataUrl(config.issuer);
}
