import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { redactSensitiveBody } from "../response-logs-internal";

describe("redactSensitiveBody", () => {
  test("keeps a health-check body readable", () => {
    const body = JSON.stringify({
      status: "unhealthy",
      checks: [
        {
          name: "database",
          status: "timeout",
          error: "timed out after 4000ms",
        },
        { name: "unkey", status: "ok", latencyMs: 3 },
      ],
    });
    expect(redactSensitiveBody(body)).toBe(body);
  });

  test("redacts values under sensitive JSON keys at any depth", () => {
    const redacted = redactSensitiveBody(
      JSON.stringify({
        user: { name: "ada", password: "hunter2" },
        session: { id: "abc" },
        items: [{ apiKey: "sk_live_123" }],
      }),
    );
    expect(redacted).toBe(
      JSON.stringify({
        user: { name: "ada", password: "[redacted]" },
        session: "[redacted]",
        items: [{ apiKey: "[redacted]" }],
      }),
    );
  });

  test("redacts tokens in non-JSON bodies", () => {
    const redacted = redactSensitiveBody(
      "error: Bearer abc.def-ghi rejected; token=s3cr3t&page=2 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
    );
    expect(redacted).toBe(
      "error: Bearer [redacted] rejected; token=[redacted]&page=2 jwt [redacted]",
    );
  });

  test("redacts whole quoted values in non-JSON bodies", () => {
    const redacted = redactSensitiveBody(
      `{"api_key": "sk live 123", password='correct horse battery' (truncated`,
    );
    expect(redacted).toBe(
      `{"api_key": "[redacted]", password='[redacted]' (truncated`,
    );
  });

  test("only matches sensitive words, not substrings", () => {
    expect(
      redactSensitiveBody(
        "monkey=1&turkey=2&obsession=3&author=ada&accessToken=abc&x-auth-token=def",
      ),
    ).toBe(
      "monkey=1&turkey=2&obsession=3&author=ada&accessToken=[redacted]&x-auth-token=[redacted]",
    );
    expect(
      redactSensitiveBody(JSON.stringify({ monkey: "1", client_secret: "s" })),
    ).toBe(JSON.stringify({ monkey: "1", client_secret: "[redacted]" }));
  });

  test("passes empty bodies through", () => {
    expect(redactSensitiveBody(null)).toBeNull();
    expect(redactSensitiveBody("")).toBe("");
  });
});
