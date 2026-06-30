import type { Workspace } from "@openstatus/db/src/schema";
import { ForbiddenError, NotFoundError } from "@openstatus/services";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { mapError, toServiceCtx } from "./adapter";

const workspace = { id: 1, slug: "ws", name: "ws" } as unknown as Workspace;

describe("toServiceCtx (MCP)", () => {
  test("propagates apiKey.scopes onto actor.scopes", () => {
    const ctx = toServiceCtx({
      workspace,
      apiKey: { id: "k1", createdById: 7, scopes: ["read"] },
      requestId: "req-1",
    });
    expect(ctx.actor.type).toBe("mcp");
    if (ctx.actor.type === "mcp") {
      expect(ctx.actor.scopes).toEqual(["read"]);
      expect(ctx.actor.keyId).toBe("k1");
      expect(ctx.actor.userId).toBe(7);
    }
  });

  test("propagates ['*'] super-admin scopes intact", () => {
    const ctx = toServiceCtx({
      workspace,
      apiKey: { id: "sa", scopes: ["*"] },
      requestId: "req-2",
    });
    if (ctx.actor.type === "mcp") {
      expect(ctx.actor.scopes).toEqual(["*"]);
    }
  });
});

describe("mapError", () => {
  test("ForbiddenError throws McpError (transport-level)", () => {
    // FORBIDDEN belongs to the unrecoverable bucket — it must escape
    // `mapError` as a thrown `McpError` rather than a recoverable
    // `CallToolResult`. The LLM has no input to retry; this is an
    // auth boundary failure.
    expect(() => mapError(new ForbiddenError("nope"))).toThrow();
  });

  test("NotFoundError returns recoverable CallToolResult", () => {
    // Sanity check that the existing recoverable branch still works
    // — proves the FORBIDDEN test above is meaningful (i.e. mapError
    // does discriminate, it's not always throwing).
    const result = mapError(new NotFoundError("page", 99));
    expect(result.isError).toBe(true);
    expect(Array.isArray(result.content)).toBe(true);
  });
});
