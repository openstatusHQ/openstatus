import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  constantTimeEqual,
  pkceChallenge,
  randomBase64Url,
  randomHex,
  sha256Hex,
  toBase64Url,
  toHex,
  verifyPkce,
} from "../crypto";

// RFC 7636 appendix B test vector.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("oauth crypto", () => {
  test("pkceChallenge matches the RFC 7636 vector", async () => {
    expect(await pkceChallenge(VERIFIER)).toBe(CHALLENGE);
  });

  test("verifyPkce accepts the matching verifier", async () => {
    expect(await verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
  });

  test("verifyPkce rejects a wrong verifier", async () => {
    expect(await verifyPkce(`${VERIFIER.slice(0, -1)}A`, CHALLENGE)).toBe(
      false,
    );
  });

  test("verifyPkce rejects verifiers outside 43..128 chars", async () => {
    expect(await verifyPkce("short", CHALLENGE)).toBe(false);
    expect(await verifyPkce("a".repeat(129), CHALLENGE)).toBe(false);
  });

  test("verifyPkce rejects verifiers with characters outside the unreserved set", async () => {
    expect(await verifyPkce(`${"a".repeat(42)}!`, CHALLENGE)).toBe(false);
  });

  test("sha256Hex matches a known digest", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("toBase64Url strips padding and uses the url alphabet", () => {
    expect(toBase64Url(new Uint8Array([251, 255, 191]))).toBe("-_-_");
    expect(toBase64Url(new Uint8Array([1]))).toBe("AQ");
  });

  test("toHex pads single-digit bytes", () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });

  test("random helpers produce distinct, well-formed values", () => {
    const a = randomBase64Url(32);
    const b = randomBase64Url(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomHex(16)).toMatch(/^[a-f0-9]{32}$/);
  });

  test("constantTimeEqual compares by value and rejects length mismatches", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
