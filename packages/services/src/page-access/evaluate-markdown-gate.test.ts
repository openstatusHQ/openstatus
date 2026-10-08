import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { evaluateMarkdownGate } from "./evaluate-markdown-gate";

const base = {
  passwordAuthorized: false,
  authEmail: null,
  authEmailDomains: null,
  clientIp: null,
  allowedIpRanges: null,
} as const;

describe("evaluateMarkdownGate", () => {
  test("public → ok", () => {
    expect(evaluateMarkdownGate({ ...base, accessType: "public" })).toEqual({
      ok: true,
    });
  });

  describe("password", () => {
    test("authorized → ok", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          passwordAuthorized: true,
        }),
      ).toEqual({ ok: true });
    });

    test("not authorized → 401", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          passwordAuthorized: false,
        }),
      ).toMatchObject({ ok: false, status: 401 });
    });
  });

  describe("email-domain", () => {
    test("allowed domain → ok", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "email-domain",
          authEmail: "alice@acme.com",
          authEmailDomains: ["acme.com"],
        }),
      ).toEqual({ ok: true });
    });

    test("no session → 403", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "email-domain",
          authEmailDomains: ["acme.com"],
        }),
      ).toMatchObject({ ok: false, status: 403 });
    });

    test("wrong domain → 403", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "email-domain",
          authEmail: "bob@evil.com",
          authEmailDomains: ["acme.com"],
        }),
      ).toMatchObject({ ok: false, status: 403 });
    });

    test("empty authEmailDomains → 403", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "email-domain",
          authEmail: "alice@acme.com",
          authEmailDomains: [],
        }),
      ).toMatchObject({ ok: false, status: 403 });
    });
  });

  describe("ip-restriction", () => {
    test("allowed IP → ok", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "ip-restriction",
          clientIp: "10.0.0.5",
          allowedIpRanges: ["10.0.0.0/24"],
        }),
      ).toEqual({ ok: true });
    });

    test("disallowed IP → 403", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "ip-restriction",
          clientIp: "192.168.1.1",
          allowedIpRanges: ["10.0.0.0/24"],
        }),
      ).toMatchObject({ ok: false, status: 403 });
    });

    test("missing IP → 403 (gap the feed route has, asserted closed)", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "ip-restriction",
          allowedIpRanges: ["10.0.0.0/24"],
        }),
      ).toMatchObject({ ok: false, status: 403 });
    });
  });
});
