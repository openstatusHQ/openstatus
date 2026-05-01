import { expect, test } from "bun:test";

import { checkResponseLogsLimit, redactSensitiveHeaders } from "./utils";

test("redactSensitiveHeaders removes secret-bearing response headers", () => {
  const headers = redactSensitiveHeaders({
    "X-Request-Id": "req_123",
    "X-Trace-Id": "trace_123",
    "X-Deployment": "deploy_123",
    "Set-Cookie": "atid=secret",
    "X-Service-Token": "secret",
    Authorization: "Bearer secret",
  });

  expect(headers).toEqual({
    "X-Request-Id": "req_123",
    "X-Trace-Id": "trace_123",
    "X-Deployment": "deploy_123",
    "Set-Cookie": "[redacted]",
    "X-Service-Token": "[redacted]",
    Authorization: "[redacted]",
  });
});

test("checkResponseLogsLimit requires the response logs entitlement", () => {
  expect(() => checkResponseLogsLimit({ "response-logs": true })).not.toThrow();
  expect(() => checkResponseLogsLimit({ "response-logs": false })).toThrow(
    "Upgrade for response logs",
  );
});
