import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { isAllowedRedirectUri } from "../redirect-allowlist";

describe("isAllowedRedirectUri", () => {
  test("allows loopback on http and https", () => {
    expect(isAllowedRedirectUri("http://localhost:3000/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:53422/cb")).toBe(true);
    expect(isAllowedRedirectUri("https://localhost/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://[::1]:8080/cb")).toBe(true);
  });

  test("allows https on allowlisted hosts and their subdomains", () => {
    expect(
      isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"),
    ).toBe(true);
    expect(isAllowedRedirectUri("https://app.openstatus.dev/cb")).toBe(true);
    expect(
      isAllowedRedirectUri(
        "https://chatgpt.com/connector_platform_oauth_redirect",
      ),
    ).toBe(true);
    expect(isAllowedRedirectUri("https://cursor.com/api/auth/callback")).toBe(
      true,
    );
  });

  test("rejects http on allowlisted hosts", () => {
    expect(isAllowedRedirectUri("http://claude.ai/cb")).toBe(false);
  });

  test("rejects lookalike hosts", () => {
    expect(isAllowedRedirectUri("https://claude.ai.evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://evilclaude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://openstatus.dev.attacker.io/cb")).toBe(
      false,
    );
  });

  test("rejects unknown hosts", () => {
    expect(isAllowedRedirectUri("https://example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://localhost.example.com/cb")).toBe(
      false,
    );
  });

  test("allows supported app schemes regardless of host", () => {
    expect(
      isAllowedRedirectUri(
        "cursor://anysphere.cursor-retrieval/oauth/callback",
      ),
    ).toBe(true);
    expect(isAllowedRedirectUri("vscode://ms-vscode.mcp/authorize")).toBe(true);
    expect(
      isAllowedRedirectUri("vscode-insiders://ms-vscode.mcp/authorize"),
    ).toBe(true);
  });

  test("rejects other custom schemes", () => {
    expect(isAllowedRedirectUri("myapp://callback")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
  });

  test("rejects fragments and unparsable input", () => {
    expect(isAllowedRedirectUri("https://claude.ai/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
    expect(isAllowedRedirectUri("")).toBe(false);
  });
});
