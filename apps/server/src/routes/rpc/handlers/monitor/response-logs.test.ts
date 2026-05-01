import { expect, test } from "bun:test";

import { redactSensitiveHeaders } from "./response-logs";

test("redactSensitiveHeaders redacts secret-bearing response headers", () => {
  const headers = redactSensitiveHeaders({
    "X-Request-Id": "req_123",
    "X-Trace-Id": "trace_123",
    "X-Deployment": "deploy_123",
    "X-Api-Key": "key",
    "X-Session-Id": "session",
    "X-Credential-Id": "credential",
    "Set-Cookie": "atid=secret",
    "X-Service-Token": "secret",
    Authorization: "Bearer secret",
  });

  expect(headers).toEqual({
    "X-Request-Id": "req_123",
    "X-Trace-Id": "trace_123",
    "X-Deployment": "deploy_123",
    "X-Api-Key": "[redacted]",
    "X-Session-Id": "[redacted]",
    "X-Credential-Id": "[redacted]",
    "Set-Cookie": "[redacted]",
    "X-Service-Token": "[redacted]",
    Authorization: "[redacted]",
  });
});
