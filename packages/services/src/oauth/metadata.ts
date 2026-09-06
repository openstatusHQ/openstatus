import { apiKeySettableScopes } from "@openstatus/db/src/schema/api-keys/constants";

import {
  CODE_CHALLENGE_METHODS,
  GRANT_TYPES,
  RESPONSE_TYPES,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from "./constants";

export const MCP_RESOURCE_PATH = "/mcp";
export const PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource/mcp";

export function mcpResource(issuer: string): string {
  return `${issuer}${MCP_RESOURCE_PATH}`;
}

export function resourceMetadataUrl(issuer: string): string {
  return `${issuer}${PROTECTED_RESOURCE_METADATA_PATH}`;
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: [...RESPONSE_TYPES],
    grant_types_supported: [...GRANT_TYPES],
    code_challenge_methods_supported: [...CODE_CHALLENGE_METHODS],
    token_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [
      ...TOKEN_ENDPOINT_AUTH_METHODS,
    ],
    scopes_supported: [...apiKeySettableScopes],
    client_id_metadata_document_supported: true,
  };
}

/** RFC 9728 protected resource metadata for the `/mcp` resource. */
export function protectedResourceMetadata(issuer: string) {
  return {
    resource: mcpResource(issuer),
    authorization_servers: [issuer],
    scopes_supported: [...apiKeySettableScopes],
    bearer_methods_supported: ["header"],
  };
}
