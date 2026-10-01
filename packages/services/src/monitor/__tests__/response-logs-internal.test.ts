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
    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("sk_live_123");
    expect(redacted).not.toContain('"abc"');
    expect(redacted).toContain('"name":"ada"');
  });

  test("redacts tokens in non-JSON bodies", () => {
    const redacted = redactSensitiveBody(
      "error: Bearer abc.def-ghi rejected; token=s3cr3t&page=2 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
    );
    expect(redacted).not.toContain("abc.def-ghi");
    expect(redacted).not.toContain("s3cr3t");
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redacted).toContain("page=2");
  });

  test("passes empty bodies through", () => {
    expect(redactSensitiveBody(null)).toBeNull();
    expect(redactSensitiveBody("")).toBe("");
  });
});
