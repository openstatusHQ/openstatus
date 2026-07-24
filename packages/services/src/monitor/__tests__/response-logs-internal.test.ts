import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { redactSensitiveHeaders } from "../response-logs-internal";

describe("redactSensitiveHeaders", () => {
  it("returns an empty object for null", () => {
    expect(redactSensitiveHeaders(null)).toEqual({});
  });

  it("redacts headers whose name is a known sensitive header", () => {
    expect(
      redactSensitiveHeaders({
        authorization: "Bearer abc",
        cookie: "sid=1",
        "x-api-key": "k",
      }),
    ).toEqual({
      authorization: "[redacted]",
      cookie: "[redacted]",
      "x-api-key": "[redacted]",
    });
  });

  it("matches sensitive names case insensitively", () => {
    expect(
      redactSensitiveHeaders({ Authorization: "Bearer abc", COOKIE: "sid=1" }),
    ).toEqual({ Authorization: "[redacted]", COOKIE: "[redacted]" });
  });

  it("redacts headers whose name contains a sensitive part", () => {
    expect(
      redactSensitiveHeaders({
        "x-session-id": "s",
        "refresh-token": "t",
        "x-secret-value": "v",
        "my-credential": "c",
      }),
    ).toEqual({
      "x-session-id": "[redacted]",
      "refresh-token": "[redacted]",
      "x-secret-value": "[redacted]",
      "my-credential": "[redacted]",
    });
  });

  it("keeps non-sensitive headers and their values untouched", () => {
    expect(
      redactSensitiveHeaders({
        "content-type": "application/json",
        "user-agent": "curl/8",
      }),
    ).toEqual({
      "content-type": "application/json",
      "user-agent": "curl/8",
    });
  });
});
