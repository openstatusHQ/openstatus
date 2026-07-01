import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  formatResponseBody,
  formatTimestamp,
  originOf,
  statusDotClass,
} from "./utils";

describe("statusDotClass", () => {
  test("null → muted", () => {
    expect(statusDotClass(null)).toBe("bg-muted-foreground/30");
  });
  test("true → success", () => {
    expect(statusDotClass(true)).toBe("bg-success");
  });
  test("false → destructive", () => {
    expect(statusDotClass(false)).toBe("bg-destructive");
  });
  test("StepResult ok=true → success", () => {
    expect(statusDotClass({ ok: true, latencyMs: 10 })).toBe("bg-success");
  });
  test("StepResult ok=false UNAUTHORIZED → info", () => {
    expect(
      statusDotClass({
        ok: false,
        latencyMs: 10,
        error: { code: "UNAUTHORIZED", message: "401" },
      }),
    ).toBe("bg-info");
  });
  test("StepResult ok=false other error → destructive", () => {
    expect(
      statusDotClass({
        ok: false,
        latencyMs: 10,
        error: { code: "TIMEOUT", message: "timed out" },
      }),
    ).toBe("bg-destructive");
  });
});

describe("originOf", () => {
  test("strips path, query, fragment", () => {
    expect(originOf("https://example.com/api?x=1#frag")).toBe(
      "https://example.com",
    );
  });
  test("keeps explicit port", () => {
    expect(originOf("https://example.com:8443/mcp")).toBe(
      "https://example.com:8443",
    );
  });
  test("strips userinfo", () => {
    expect(originOf("https://user:pass@example.com/mcp")).toBe(
      "https://example.com",
    );
  });
  test("invalid URL returns input unchanged", () => {
    expect(originOf("not a url")).toBe("not a url");
  });
});

describe("formatTimestamp", () => {
  test("returns a non-empty string with the date parts", () => {
    const out = formatTimestamp(new Date("2026-05-22T10:15:30Z"));
    expect(out.length).toBeGreaterThan(0);
    // en-US "long" month locale-independent enough to assert "2026" presence
    expect(out).toContain("2026");
    expect(out).toContain("May");
  });
});

describe("formatResponseBody", () => {
  test("undefined input → empty string", () => {
    expect(formatResponseBody(undefined)).toBe("");
  });

  test("empty / whitespace input → returns raw unchanged", () => {
    expect(formatResponseBody("   ")).toBe("   ");
  });

  test("valid JSON → pretty-printed with 2-space indent", () => {
    const out = formatResponseBody('{"jsonrpc":"2.0","id":"x","result":{}}');
    expect(out).toBe(
      JSON.stringify({ jsonrpc: "2.0", id: "x", result: {} }, null, 2),
    );
  });

  test("single SSE frame → pretty-printed JSON payload", () => {
    const sse = [
      "event: message",
      'data: {"jsonrpc":"2.0","id":"x","result":{"ok":true}}',
      "",
    ].join("\n");
    const out = formatResponseBody(sse);
    expect(out).toBe(
      JSON.stringify(
        { jsonrpc: "2.0", id: "x", result: { ok: true } },
        null,
        2,
      ),
    );
  });

  test("multiple SSE frames → joined with blank line", () => {
    const sse = [
      "event: message",
      'data: {"jsonrpc":"2.0","id":1}',
      "",
      "event: message",
      'data: {"jsonrpc":"2.0","id":2}',
      "",
    ].join("\n");
    const out = formatResponseBody(sse);
    expect(out).toBe(
      [
        JSON.stringify({ jsonrpc: "2.0", id: 1 }, null, 2),
        JSON.stringify({ jsonrpc: "2.0", id: 2 }, null, 2),
      ].join("\n\n"),
    );
  });

  test("SSE data spanning two `data:` lines → joined with newline before parse", () => {
    const sse = ['data: {"a":', "data: 1}", ""].join("\n");
    const out = formatResponseBody(sse);
    expect(out).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  test("non-JSON HTML → passed through unchanged", () => {
    const html = "<!doctype html><html>nope</html>";
    expect(formatResponseBody(html)).toBe(html);
  });

  test("truncation marker preserved on JSON path", () => {
    const raw = `${JSON.stringify({ id: "x" })}…[truncated]`;
    const out = formatResponseBody(raw);
    expect(out.startsWith(JSON.stringify({ id: "x" }, null, 2))).toBe(true);
    expect(out.endsWith("\n…[truncated]")).toBe(true);
  });

  test("truncation marker preserved on SSE path", () => {
    const raw = `${["event: message", 'data: {"id":"x"}', "", ""].join("\n")}…[truncated]`;
    const out = formatResponseBody(raw);
    expect(out.endsWith("\n…[truncated]")).toBe(true);
    expect(out).toContain(JSON.stringify({ id: "x" }, null, 2));
  });
});
