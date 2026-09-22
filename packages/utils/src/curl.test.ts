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

  it("sends decoded binary POST bytes without shell or text conversion", async () => {
    const server = Deno.serve(
      { hostname: "127.0.0.1", port: 0 },
      async (request) => new Response(await request.arrayBuffer()),
    );
    try {
      for (const { body, bytes } of [
        {
          body: "data:application/octet-stream;base64,AP8nJFwNCgA=",
          bytes: [0, 255, 39, 36, 92, 13, 10, 0],
        },
        { body: "data:application/octet-stream;base64,", bytes: [] },
        {
          body: "data:application/octet-stream;base64,aGVs\r\nbG8=",
          bytes: [104, 101, 108, 108, 111],
        },
      ]) {
        const command = buildCurlCommand({
          url: `http://127.0.0.1:${server.addr.port}/upload`,
          method: "POST",
          body,
          headers: [{ key: "Content-Type", value: "application/octet-stream" }],
          timeout: 5000,
        });
        const result = await new Deno.Command("sh", {
          args: ["-c", command],
          env: { NO_PROXY: "*" },
          stdout: "piped",
          stderr: "piped",
        }).output();
        expect(result.code).toBe(0);
        expect(result.stdout).toEqual(new Uint8Array(bytes));
      }
    } finally {
      await server.shutdown();
    }
  });

  it("rejects malformed binary bodies before sending a request", async () => {
    let requests = 0;
    const server = Deno.serve({ hostname: "127.0.0.1", port: 0 }, () => {
      requests++;
      return new Response("received");
    });
    try {
      for (const body of [
        "",
        "not a data URL",
        "data:application/octet-stream;base64,aGVsbG8=,extra",
        "data:application/octet-stream;base64,aGVsbG8=!",
        "data:application/octet-stream;base64,aGVsbG8",
        "data:application/octet-stream;base64,aGVsbG8=\u2028",
      ]) {
        const command = buildCurlCommand({
          url: `http://127.0.0.1:${server.addr.port}/upload`,
          method: "POST",
          body,
          headers: [{ key: "Content-Type", value: "application/octet-stream" }],
          timeout: 5000,
        });
        const result = await new Deno.Command("sh", {
          args: ["-c", command],
          env: { NO_PROXY: "*" },
          stdout: "piped",
          stderr: "piped",
        }).output();
        expect(requests).toBe(0);
        expect(result.code).not.toBe(0);
      }
    } finally {
      await server.shutdown();
    }
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
