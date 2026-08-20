import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { buildCurlCommand } from "./curl";

describe("buildCurlCommand", () => {
  it("renders a plain GET without an explicit method", () => {
    expect(buildCurlCommand({ url: "https://example.com" })).toBe(
      "curl \\\n  'https://example.com' \\\n  -H 'User-Agent: OpenStatus/1.0'",
    );
  });

  it("keeps the method explicit when a GET carries a body", () => {
    const command = buildCurlCommand({
      url: "https://example.com",
      method: "GET",
      body: "hello",
    });
    expect(command).toContain("-X GET");
    expect(command).toContain("--data-raw 'hello'");
  });

  it("defaults POST to application/json", () => {
    const command = buildCurlCommand({
      url: "https://example.com",
      method: "POST",
      body: '{"a":1}',
    });
    expect(command).toContain("-H 'Content-Type: application/json'");
    expect(command).toContain(`--data-raw '{"a":1}'`);
  });

  it("does not override a custom content type or user agent", () => {
    const command = buildCurlCommand({
      url: "https://example.com",
      method: "POST",
      headers: [
        { key: "content-type", value: "text/plain" },
        { key: "user-agent", value: "custom" },
      ],
    });
    expect(command).not.toContain("application/json");
    expect(command).not.toContain("OpenStatus/1.0");
    expect(command).toContain("-H 'content-type: text/plain'");
  });

  it("skips headers without a key", () => {
    const command = buildCurlCommand({
      url: "https://example.com",
      headers: [
        { key: "  ", value: "ignored" },
        { key: "X-Key", value: "kept" },
      ],
    });
    expect(command).not.toContain("ignored");
    expect(command).toContain("-H 'X-Key: kept'");
  });

  it("escapes single quotes so the command stays a single argument", () => {
    const command = buildCurlCommand({
      url: "https://example.com/?q=it's",
      headers: [{ key: "X-Quote", value: "a'b" }],
    });
    expect(command).toContain(`'https://example.com/?q=it'\\''s'`);
    expect(command).toContain(`-H 'X-Quote: a'\\''b'`);
  });

  it("adds -L only when redirects are followed", () => {
    expect(
      buildCurlCommand({ url: "https://example.com", followRedirects: true }),
    ).toContain("-L");
    expect(
      buildCurlCommand({ url: "https://example.com", followRedirects: false }),
    ).not.toContain("-L");
  });

  it("converts the timeout to seconds", () => {
    expect(
      buildCurlCommand({ url: "https://example.com", timeout: 45000 }),
    ).toContain("--max-time 45");
    expect(
      buildCurlCommand({ url: "https://example.com", timeout: 1500 }),
    ).toContain("--max-time 1.5");
    expect(
      buildCurlCommand({ url: "https://example.com", timeout: 0 }),
    ).not.toContain("--max-time");
  });
});
