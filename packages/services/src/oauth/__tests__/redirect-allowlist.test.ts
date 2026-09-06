import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  isAllowedRedirectUri,
  matchesRegisteredRedirectUri,
} from "../redirect-allowlist";

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
    expect(isAllowedRedirectUri("https://claude.ai/cb#")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pw@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://user@app.openstatus.dev/cb")).toBe(
      false,
    );
    expect(isAllowedRedirectUri("http://user@localhost:3000/cb")).toBe(false);
  });

  test("rejects empty userinfo that URL parsing drops", () => {
    expect(isAllowedRedirectUri("https://@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://:@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("http://@localhost:3000/cb")).toBe(false);
    expect(isAllowedRedirectUri("cursor://@callback")).toBe(false);
    expect(isAllowedRedirectUri("https:\n//@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
    expect(isAllowedRedirectUri("")).toBe(false);
  });
});

describe("matchesRegisteredRedirectUri", () => {
  const registered = [
    "http://localhost/callback",
    "http://127.0.0.1/callback",
    "https://claude.ai/api/mcp/auth_callback",
  ];

  test("ignores the port on loopback (RFC 8252 §7.3)", () => {
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://localhost:53495/callback",
      ),
    ).toBe(true);
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://127.0.0.1:8080/callback",
      ),
    ).toBe(true);
    expect(
      matchesRegisteredRedirectUri(
        ["http://localhost:3000/cb"],
        "http://localhost/cb",
      ),
    ).toBe(true);
  });

  test("still requires scheme, host, path and query to match on loopback", () => {
    expect(
      matchesRegisteredRedirectUri(registered, "https://localhost:1/callback"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(registered, "http://[::1]:1/callback"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(registered, "http://localhost:1/other"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://localhost:1/callback?x=1",
      ),
    ).toBe(false);
  });

  test("rejects userinfo even when the registered entry carries it", () => {
    const legacy = ["https://user:pw@claude.ai/cb", "http://user@localhost/cb"];
    expect(
      matchesRegisteredRedirectUri(legacy, "https://user:pw@claude.ai/cb"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(legacy, "http://user@localhost:1/cb"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        ["https://@claude.ai/cb"],
        "https://@claude.ai/cb",
      ),
    ).toBe(false);
  });

  test("a legacy loopback entry with userinfo never widens the match", () => {
    expect(
      matchesRegisteredRedirectUri(
        ["http://user:pw@localhost/cb"],
        "http://localhost:1/cb",
      ),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        ["http://@localhost/cb"],
        "http://localhost:1/cb",
      ),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        ["http://localhost/cb#x"],
        "http://localhost:1/cb",
      ),
    ).toBe(false);
  });

  test("rejects fragments and userinfo on loopback", () => {
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://localhost:1/callback#frag",
      ),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(registered, "http://localhost:1/callback#"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://user:pass@localhost:1/callback",
      ),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "http://user@127.0.0.1:1/callback",
      ),
    ).toBe(false);
  });

  test("requires an exact match for non-loopback hosts", () => {
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "https://claude.ai/api/mcp/auth_callback",
      ),
    ).toBe(true);
    expect(
      matchesRegisteredRedirectUri(
        registered,
        "https://claude.ai:8443/api/mcp/auth_callback",
      ),
    ).toBe(false);
    expect(matchesRegisteredRedirectUri(registered, "not a url")).toBe(false);
  });
});
