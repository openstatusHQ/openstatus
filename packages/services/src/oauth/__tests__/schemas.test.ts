import {
  apiKeySettableScopes,
  scopePresets,
} from "@openstatus/db/src/schema/api-keys/constants";
import { describe, expect, test } from "vitest";

import { DEFAULT_SCOPE } from "../constants";
import {
  RegisterClientInput,
  formatScope,
  normalizeScopes,
  parseScopeParam,
} from "../schemas";

describe("parseScopeParam", () => {
  test("defaults to the setup preset when absent or blank", () => {
    expect(DEFAULT_SCOPE).toEqual(scopePresets.setup);
    expect(parseScopeParam(undefined)).toEqual({
      scopes: [...scopePresets.setup],
      invalid: [],
    });
    expect(parseScopeParam("")).toEqual({
      scopes: [...scopePresets.setup],
      invalid: [],
    });
    expect(parseScopeParam("   ").scopes).toEqual([...scopePresets.setup]);
  });

  test("accepts a mixed string in canonical order", () => {
    expect(
      parseScopeParam("pages:read incidents:write monitors:read").scopes,
    ).toEqual(["monitors:read", "pages:read", "incidents:write"]);
    expect(
      parseScopeParam(" notifications:read  subscribers:write ").scopes,
    ).toEqual(["notifications:read", "subscribers:write"]);
  });

  test("dedupes and drops scopes implied by another held scope", () => {
    expect(parseScopeParam("read write").scopes).toEqual(["write"]);
    expect(parseScopeParam("write monitors:read").scopes).toEqual(["write"]);
    expect(parseScopeParam("monitors:write monitors:read").scopes).toEqual([
      "monitors:write",
    ]);
    expect(parseScopeParam("read monitors:read pages:write").scopes).toEqual([
      "read",
      "pages:write",
    ]);
    expect(parseScopeParam("monitors:read monitors:read").scopes).toEqual([
      "monitors:read",
    ]);
  });

  test("read implies subscribers:read", () => {
    expect(parseScopeParam("read subscribers:read").scopes).toEqual(["read"]);
  });

  test("keeps read alone", () => {
    expect(parseScopeParam("read").scopes).toEqual(["read"]);
  });

  test("reports unknown scopes without partially accepting", () => {
    expect(parseScopeParam("read admin")).toEqual({
      scopes: [],
      invalid: ["admin"],
    });
    expect(parseScopeParam("*").invalid).toEqual(["*"]);
    expect(parseScopeParam("monitors:read any monitor.read").invalid).toEqual([
      "any",
      "monitor.read",
    ]);
  });

  test("every settable scope parses to itself", () => {
    for (const scope of apiKeySettableScopes) {
      expect(parseScopeParam(scope).scopes).toEqual([scope]);
    }
  });
});

describe("normalizeScopes / formatScope", () => {
  test("write implies read", () => {
    expect(normalizeScopes(["read", "write"])).toEqual(["write"]);
    expect(formatScope(["write"])).toBe("write");
    expect(formatScope(["read"])).toBe("read");
  });

  test("group write implies the group read and orders canonically", () => {
    expect(
      normalizeScopes(["incidents:write", "monitors:read", "monitors:write"]),
    ).toEqual(["monitors:write", "incidents:write"]);
    expect(
      formatScope(["pages:read", "monitors:write", "incidents:write"]),
    ).toBe("monitors:write pages:read incidents:write");
    expect(formatScope(scopePresets.setup)).toBe(
      "monitors:write pages:write incidents:write notifications:read",
    );
  });

  test("folds '*' into write defensively", () => {
    expect(normalizeScopes(["*"])).toEqual(["write"]);
    expect(normalizeScopes(["*", "monitors:read"])).toEqual(["write"]);
  });
});

describe("RegisterClientInput", () => {
  test("accepts a minimal public client", () => {
    const parsed = RegisterClientInput.safeParse({
      redirect_uris: ["http://localhost:1234/cb"],
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects confidential auth methods", () => {
    const parsed = RegisterClientInput.safeParse({
      redirect_uris: ["http://localhost:1234/cb"],
      token_endpoint_auth_method: "client_secret_basic",
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects unsupported grant and response types", () => {
    expect(
      RegisterClientInput.safeParse({
        redirect_uris: ["http://localhost:1234/cb"],
        grant_types: ["client_credentials"],
      }).success,
    ).toBe(false);
    expect(
      RegisterClientInput.safeParse({
        redirect_uris: ["http://localhost:1234/cb"],
        response_types: ["token"],
      }).success,
    ).toBe(false);
  });

  test("rejects empty redirect_uris", () => {
    expect(RegisterClientInput.safeParse({ redirect_uris: [] }).success).toBe(
      false,
    );
  });
});
