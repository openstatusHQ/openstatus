import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { validateKey } from "./auth";

/**
 * `validateKey` has three production branches (custom DB key, Unkey
 * fallback, super-admin) and one dev fallback. Tests here cover the
 * dev fallback exhaustively. The production branches require flipping
 * `NODE_ENV` at module-load time, which reroutes other middleware in
 * this app (see `routes/mcp/handler.test.ts` for the same caveat) — a
 * dedicated production-mode test harness is out of scope.
 *
 * What we DO assert structurally even without that harness:
 *   - dev fallback returns scopes `['*']` (so local dev mirrors super-
 *     admin and isn't accidentally locked out by scope checks)
 *   - the `keyId` round-trips so audit attribution holds
 */
describe("validateKey (dev fallback)", () => {
  test("returns scopes ['*'] so local dev mirrors super-admin", async () => {
    const { result, error } = await validateKey("anything");
    expect(error).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(result.scopes).toEqual(["*"]);
  });

  test("uses the input string as both ownerId and keyId", async () => {
    const { result } = await validateKey("dev-key-42");
    expect(result.ownerId).toBe("dev-key-42");
    expect(result.keyId).toBe("dev-key-42");
    expect(result.authMethod).toBe("dev");
  });
});
