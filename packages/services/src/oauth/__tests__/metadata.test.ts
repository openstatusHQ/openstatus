import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  authorizationServerMetadata,
  mcpResource,
  protectedResourceMetadata,
  resourceMetadataUrl,
} from "../metadata";

const ISSUER = "https://api.example.test";

describe("oauth metadata", () => {
  test("authorization server document derives every endpoint from the issuer", () => {
    const doc = authorizationServerMetadata(ISSUER);
    expect(doc.issuer).toBe(ISSUER);
    for (const key of [
      "authorization_endpoint",
      "token_endpoint",
      "registration_endpoint",
      "revocation_endpoint",
    ] as const) {
      expect(doc[key].startsWith(`${ISSUER}/oauth/`)).toBe(true);
    }
    expect(doc.response_types_supported).toEqual(["code"]);
    expect(doc.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
    ]);
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    expect(doc.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(doc.scopes_supported).toEqual(["read", "write"]);
  });

  test("protected resource document names the MCP resource and the issuer", () => {
    const doc = protectedResourceMetadata(ISSUER);
    expect(doc.resource).toBe(`${ISSUER}/mcp`);
    expect(doc.authorization_servers).toEqual([ISSUER]);
    expect(doc.bearer_methods_supported).toEqual(["header"]);
    expect(doc.scopes_supported).toEqual(
      authorizationServerMetadata(ISSUER).scopes_supported,
    );
  });

  test("resource helpers agree with the documents", () => {
    expect(mcpResource(ISSUER)).toBe(
      protectedResourceMetadata(ISSUER).resource,
    );
    expect(resourceMetadataUrl(ISSUER)).toBe(
      `${ISSUER}/.well-known/oauth-protected-resource/mcp`,
    );
  });
});
