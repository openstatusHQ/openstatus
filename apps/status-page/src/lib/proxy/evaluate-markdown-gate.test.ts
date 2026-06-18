import { describe, expect, test } from "bun:test";

import { evaluateMarkdownGate } from "./evaluate-markdown-gate";

const base = {
  password: null,
  queryPassword: null,
  cookiePassword: undefined,
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
    test("correct via query → ok", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          password: "s3cret",
          queryPassword: "s3cret",
        }),
      ).toEqual({ ok: true });
    });

    test("correct via cookie → ok", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          password: "s3cret",
          cookiePassword: "s3cret",
        }),
      ).toEqual({ ok: true });
    });

    test("wrong → 401", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          password: "s3cret",
          queryPassword: "nope",
        }),
      ).toMatchObject({ ok: false, status: 401 });
    });

    test("missing → 401", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          password: "s3cret",
        }),
      ).toMatchObject({ ok: false, status: 401 });
    });

    test("empty-string stored password never authorizes empty input → 401", () => {
      expect(
        evaluateMarkdownGate({
          ...base,
          accessType: "password",
          password: "",
          queryPassword: "",
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
