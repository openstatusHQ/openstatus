import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { extractCredential } from "./credentials";

describe("extractCredential", () => {
  test("reads x-openstatus-key", () => {
    const headers = new Headers({ "x-openstatus-key": "os_abc" });
    expect(extractCredential(headers)).toEqual({
      token: "os_abc",
      source: "x-openstatus-key",
    });
  });

  test("falls back to a bearer token, case-insensitively", () => {
    expect(
      extractCredential(new Headers({ Authorization: "Bearer os_oat_x" })),
    ).toEqual({
      token: "os_oat_x",
      source: "bearer",
    });
    expect(
      extractCredential(new Headers({ authorization: "bearer   os_oat_y " }))
        ?.token,
    ).toBe("os_oat_y");
  });

  test("prefers the header over the bearer token when both are present", () => {
    const headers = new Headers({
      "x-openstatus-key": "os_key",
      Authorization: "Bearer os_oat_x",
    });
    expect(extractCredential(headers)?.token).toBe("os_key");
  });

  test("ignores non-bearer authorization schemes and empty values", () => {
    expect(
      extractCredential(new Headers({ Authorization: "Basic abc" })),
    ).toBeNull();
    expect(
      extractCredential(new Headers({ Authorization: "Bearer" })),
    ).toBeNull();
    expect(
      extractCredential(new Headers({ Authorization: "Bearer a b" })),
    ).toBeNull();
    expect(extractCredential(new Headers())).toBeNull();
  });
});
