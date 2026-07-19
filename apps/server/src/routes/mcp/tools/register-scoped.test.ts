import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { registerScopedTool } from "./register-scoped";

const wsStub = { id: 1, slug: "ws", name: "ws" } as unknown as Workspace;

function makeServer() {
  return new McpServer(
    { name: "test", version: "0.0.0" },
    { capabilities: { tools: { listChanged: false } } },
  );
}

function ctxWithScopes(
  scopes: ServiceContext["actor"] extends infer A
    ? A extends { scopes: infer S }
      ? S
      : never
    : never,
): ServiceContext {
  return {
    workspace: wsStub,
    actor: {
      type: "mcp",
      keyId: "k",
      scopes: scopes as never,
    },
  };
}

describe("registerScopedTool", () => {
  test("registers when actor scope satisfies tool scope", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["write"]);
    const result = registerScopedTool(
      server,
      ctx,
      "demo_write",
      {
        scope: "write",
        description: "demo",
        annotations: { readOnlyHint: false },
        inputSchema: {},
      },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    expect(result).toBeDefined();
  });

  test("returns undefined (not registered) when actor scope is insufficient", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["read"]);
    const result = registerScopedTool(
      server,
      ctx,
      "demo_write_skipped",
      {
        scope: "write",
        description: "demo",
        annotations: { readOnlyHint: false },
        inputSchema: {},
      },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    expect(result).toBeUndefined();
  });

  test("throws when readOnlyHint disagrees with scope (write tool, hint=true)", () => {
    // The disagreement guard is defense-in-depth: a write tool that
    // declares `readOnlyHint: true` would lie to MCP clients about
    // safe-to-call status. Catching it at registration means it can't
    // ship.
    const server = makeServer();
    const ctx = ctxWithScopes(["*"]);
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "lying_tool",
        {
          scope: "write",
          description: "writes but claims read-only",
          annotations: { readOnlyHint: true },
          inputSchema: {},
        },
        async () => ({ content: [{ type: "text", text: "ok" }] }),
      ),
    ).toThrow(/disagrees with annotations.readOnlyHint/);
  });

  test("throws when readOnlyHint disagrees with scope (read tool, hint=false)", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["*"]);
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "wrong_read_hint",
        {
          scope: "read",
          description: "reads but claims not read-only",
          annotations: { readOnlyHint: false },
          inputSchema: {},
        },
        async () => ({ content: [{ type: "text", text: "ok" }] }),
      ),
    ).toThrow(/disagrees with annotations.readOnlyHint/);
  });

  test("accepts a tool that omits readOnlyHint (no validation triggered)", () => {
    // The hint is recommended per the MCP spec, but optional. When
    // absent, the wrapper passes annotations through unchanged — the
    // SDK / client treats it as unspecified.
    const server = makeServer();
    const ctx = ctxWithScopes(["*"]);
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "no_hint",
        {
          scope: "read",
          description: "no hint declared",
          annotations: { openWorldHint: false },
          inputSchema: {},
        },
        async () => ({ content: [{ type: "text", text: "ok" }] }),
      ),
    ).not.toThrow();
  });
});
