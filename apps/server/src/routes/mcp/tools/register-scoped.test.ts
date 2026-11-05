import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import { describe, expect, test } from "vitest";

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

  test("a group write key sees its group's read and write tools plus `any` tools", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["incidents:write"]);
    const register = (
      name: string,
      scope: Parameters<typeof registerScopedTool>[3]["scope"],
    ) =>
      registerScopedTool(
        server,
        ctx,
        name,
        { scope, description: "demo", inputSchema: {} },
        async () => ({ content: [{ type: "text", text: "ok" }] }),
      );
    expect(register("incident_write", "incidents:write")).toBeDefined();
    expect(register("incident_read", "incidents:read")).toBeDefined();
    expect(register("public_doc", "any")).toBeDefined();
    expect(register("monitor_write", "monitors:write")).toBeUndefined();
    expect(register("monitor_read", "monitors:read")).toBeUndefined();
  });

  test("a group read key sees no write tool, not even in its own group", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["monitors:read"]);
    const register = (
      name: string,
      scope: Parameters<typeof registerScopedTool>[3]["scope"],
    ) =>
      registerScopedTool(
        server,
        ctx,
        name,
        { scope, description: "demo", inputSchema: {} },
        async () => ({ content: [{ type: "text", text: "ok" }] }),
      );
    expect(register("monitor_read", "monitors:read")).toBeDefined();
    expect(register("public_doc", "any")).toBeDefined();
    expect(register("monitor_write", "monitors:write")).toBeUndefined();
    expect(register("incident_read", "incidents:read")).toBeUndefined();
  });

  test("readOnlyHint consistency follows isReadScope for group and `any` scopes", () => {
    const server = makeServer();
    const ctx = ctxWithScopes(["*"]);
    const handler = async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    });
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "group_read_ok",
        {
          scope: "incidents:read",
          description: "d",
          annotations: { readOnlyHint: true },
          inputSchema: {},
        },
        handler,
      ),
    ).not.toThrow();
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "any_ok",
        {
          scope: "any",
          description: "d",
          annotations: { readOnlyHint: true },
          inputSchema: {},
        },
        handler,
      ),
    ).not.toThrow();
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "group_write_lies",
        {
          scope: "incidents:write",
          description: "d",
          annotations: { readOnlyHint: true },
          inputSchema: {},
        },
        handler,
      ),
    ).toThrow(/disagrees with annotations.readOnlyHint/);
    expect(() =>
      registerScopedTool(
        server,
        ctx,
        "group_read_lies",
        {
          scope: "incidents:read",
          description: "d",
          annotations: { readOnlyHint: false },
          inputSchema: {},
        },
        handler,
      ),
    ).toThrow(/disagrees with annotations.readOnlyHint/);
  });
});
