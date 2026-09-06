import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  RegisterClientInput,
  formatScope,
  normalizeScopes,
  parseScopeParam,
} from "../schemas";

describe("parseScopeParam", () => {
  test("defaults to write when absent or blank", () => {
    expect(parseScopeParam(undefined)).toEqual({
      scopes: ["write"],
      invalid: [],
    });
    expect(parseScopeParam("")).toEqual({ scopes: ["write"], invalid: [] });
    expect(parseScopeParam("   ")).toEqual({ scopes: ["write"], invalid: [] });
  });

  test("collapses read+write to write", () => {
    expect(parseScopeParam("read write").scopes).toEqual(["write"]);
    expect(parseScopeParam("write").scopes).toEqual(["write"]);
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
  });
});

describe("normalizeScopes / formatScope", () => {
  test("write implies read", () => {
    expect(normalizeScopes(["read", "write"])).toEqual(["write"]);
    expect(formatScope(["write"])).toBe("write");
    expect(formatScope(["read"])).toBe("read");
  });

  test("folds '*' into write defensively", () => {
    expect(normalizeScopes(["*"])).toEqual(["write"]);
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
