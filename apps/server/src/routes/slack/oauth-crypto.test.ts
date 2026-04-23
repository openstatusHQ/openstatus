import { describe, expect, test } from "bun:test";
import { decodeState, encodeState, verifyInstallToken } from "./oauth-crypto";

describe("encodeState / decodeState", () => {
  test("round-trips a valid state", () => {
    const state = { workspaceId: 42, ts: Date.now() };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  test("returns null for tampered state", () => {
    const encoded = encodeState({ workspaceId: 42, ts: Date.now() });
    const decoded = Buffer.from(encoded, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    const payload = decoded.slice(0, dotIdx);
    const tamperedPayload = payload.replace("42", "99");
    const tampered = Buffer.from(
      `${tamperedPayload}.${decoded.slice(dotIdx + 1)}`,
    ).toString("base64url");
    expect(decodeState(tampered)).toBeNull();
  });

  test("returns null for expired state (>10 min)", () => {
    const state = { workspaceId: 42, ts: Date.now() - 11 * 60 * 1000 };
    const encoded = encodeState(state);
    expect(decodeState(encoded)).toBeNull();
  });

  test("returns null for garbage input", () => {
    expect(decodeState("not-valid-base64!!!")).toBeNull();
  });
});

describe("verifyInstallToken", () => {
  test("returns null for invalid token", () => {
    expect(verifyInstallToken("invalid")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(verifyInstallToken("")).toBeNull();
  });
});
