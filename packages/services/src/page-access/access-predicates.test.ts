import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  isEmailDomainAuthorized,
  isIpAuthorized,
  isPasswordAuthorized,
} from "./access-predicates";

describe("isPasswordAuthorized", () => {
  test("matching cookie authorizes", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: null,
        cookiePassword: "s3cret",
      }),
    ).toBe(true);
  });

  test("matching query param authorizes", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: "s3cret",
        cookiePassword: null,
      }),
    ).toBe(true);
  });

  test("a wrong query param does not fall through to a valid cookie", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: "nope",
        cookiePassword: "s3cret",
      }),
    ).toBe(false);
  });

  test("an empty query param counts as submitted and loses", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: "",
        cookiePassword: "s3cret",
      }),
    ).toBe(false);
  });

  test("an absent query param defers to the cookie", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: undefined,
        cookiePassword: "s3cret",
      }),
    ).toBe(true);
  });

  test("no stored password never authorizes, whatever is submitted", () => {
    for (const stored of [null, undefined, ""]) {
      expect(
        isPasswordAuthorized({
          stored,
          queryPassword: "",
          cookiePassword: "",
        }),
      ).toBe(false);
      expect(
        isPasswordAuthorized({
          stored,
          queryPassword: "anything",
          cookiePassword: null,
        }),
      ).toBe(false);
    }
  });

  test("nothing submitted → denied", () => {
    expect(
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: null,
        cookiePassword: undefined,
      }),
    ).toBe(false);
  });

  test("comparison is exact: case, whitespace, prefixes and length all count", () => {
    const deny = (submitted: string) =>
      isPasswordAuthorized({
        stored: "s3cret",
        queryPassword: submitted,
        cookiePassword: null,
      });
    expect(deny("S3CRET")).toBe(false);
    expect(deny(" s3cret")).toBe(false);
    expect(deny("s3cret ")).toBe(false);
    expect(deny("s3cre")).toBe(false);
    expect(deny("s3cretx")).toBe(false);
    expect(deny("")).toBe(false);
  });

  test("non-ASCII passwords compare by code unit", () => {
    expect(
      isPasswordAuthorized({
        stored: "pässwörd✅",
        queryPassword: "pässwörd✅",
        cookiePassword: null,
      }),
    ).toBe(true);
    expect(
      isPasswordAuthorized({
        stored: "pässwörd✅",
        queryPassword: "passwörd✅",
        cookiePassword: null,
      }),
    ).toBe(false);
  });
});

describe("isEmailDomainAuthorized", () => {
  test("domain in the allow-list authorizes", () => {
    expect(isEmailDomainAuthorized("dev@acme.com", ["acme.com"])).toBe(true);
  });

  test("matching is case-insensitive on both sides", () => {
    expect(isEmailDomainAuthorized("Dev@ACME.com", ["acme.com"])).toBe(true);
    expect(isEmailDomainAuthorized("dev@acme.com", ["ACME.COM"])).toBe(true);
  });

  test("a subdomain of an allowed domain is not allowed", () => {
    expect(isEmailDomainAuthorized("dev@mail.acme.com", ["acme.com"])).toBe(
      false,
    );
  });

  test("a suffix look-alike is not allowed", () => {
    expect(isEmailDomainAuthorized("dev@evilacme.com", ["acme.com"])).toBe(
      false,
    );
    expect(isEmailDomainAuthorized("dev@acme.com.evil.com", ["acme.com"])).toBe(
      false,
    );
  });

  test("empty or missing allow-list denies", () => {
    expect(isEmailDomainAuthorized("dev@acme.com", [])).toBe(false);
    expect(isEmailDomainAuthorized("dev@acme.com", null)).toBe(false);
    expect(isEmailDomainAuthorized("dev@acme.com", undefined)).toBe(false);
  });

  test("no session email denies", () => {
    expect(isEmailDomainAuthorized(null, ["acme.com"])).toBe(false);
    expect(isEmailDomainAuthorized(undefined, ["acme.com"])).toBe(false);
    expect(isEmailDomainAuthorized("", ["acme.com"])).toBe(false);
  });

  test("an address without a domain denies", () => {
    expect(isEmailDomainAuthorized("dev", ["acme.com"])).toBe(false);
    expect(isEmailDomainAuthorized("dev@", ["acme.com"])).toBe(false);
  });

  test("only the first domain of a multi-@ address is read", () => {
    // `split("@")[1]` — "a@b@acme.com" checks "b", not "acme.com".
    expect(isEmailDomainAuthorized("a@b@acme.com", ["acme.com"])).toBe(false);
    expect(isEmailDomainAuthorized("a@acme.com@b", ["acme.com"])).toBe(true);
  });
});

describe("isIpAuthorized", () => {
  test("IP inside an allowed range authorizes", () => {
    expect(isIpAuthorized("192.168.1.42", ["192.168.1.0/24"])).toBe(true);
  });

  test("IP outside every range denies", () => {
    expect(isIpAuthorized("10.0.0.1", ["192.168.1.0/24"])).toBe(false);
  });

  test("no ranges configured denies (fail closed)", () => {
    expect(isIpAuthorized("192.168.1.42", [])).toBe(false);
    expect(isIpAuthorized("192.168.1.42", null)).toBe(false);
    expect(isIpAuthorized("192.168.1.42", undefined)).toBe(false);
  });

  test("no client IP denies (fail closed)", () => {
    expect(isIpAuthorized(null, ["0.0.0.0/0"])).toBe(false);
    expect(isIpAuthorized(undefined, ["0.0.0.0/0"])).toBe(false);
    expect(isIpAuthorized("", ["0.0.0.0/0"])).toBe(false);
  });

  test("a malformed range is skipped, the rest still evaluated", () => {
    expect(
      isIpAuthorized("192.168.1.42", ["not-a-cidr", "192.168.1.0/24"]),
    ).toBe(true);
  });
});
