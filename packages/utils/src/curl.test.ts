import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { describe, expect, it } from "vitest";

import { buildCurlCommand } from "./curl";

async function serve(onBody: (body: Buffer) => Buffer | string) {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => res.end(onBody(Buffer.concat(chunks))));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// Async on purpose: the server above runs in this process, so a sync spawn
// would block the request it is waiting on.
function sh(command: string) {
  return new Promise<{ code: number | null; stdout: Uint8Array }>(
    (resolve, reject) => {
      const child = spawn("sh", ["-c", command], {
        env: { ...process.env, NO_PROXY: "*" },
      });
      const chunks: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.on("error", reject);
      child.on("close", (code) =>
        resolve({ code, stdout: new Uint8Array(Buffer.concat(chunks)) }),
      );
    },
  );
}

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
    const server = await serve((body) => body);
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
          url: `http://127.0.0.1:${server.port}/upload`,
          method: "POST",
          body,
          headers: [{ key: "Content-Type", value: "application/octet-stream" }],
          timeout: 5000,
        });
        const result = await sh(command);
        expect(result.code).toBe(0);
        expect(result.stdout).toEqual(new Uint8Array(bytes));
      }
    } finally {
      await server.close();
    }
  });

  it("rejects malformed binary bodies before sending a request", async () => {
    let requests = 0;
    const server = await serve(() => {
      requests++;
      return "received";
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
          url: `http://127.0.0.1:${server.port}/upload`,
          method: "POST",
          body,
          headers: [{ key: "Content-Type", value: "application/octet-stream" }],
          timeout: 5000,
        });
        const result = await sh(command);
        expect(requests).toBe(0);
        expect(result.code).not.toBe(0);
      }
    } finally {
      await server.close();
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
