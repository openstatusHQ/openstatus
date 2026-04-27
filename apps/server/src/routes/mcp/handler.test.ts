import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { db, eq } from "@openstatus/db";
import { auditLog, page, statusReport } from "@openstatus/db/src/schema";
import { SEEDED_WORKSPACE_TEAM_ID } from "@openstatus/services/test/fixtures";

import { mcpRoute } from "./index";

/** Build a fresh Hono app with the same middleware chain as production. */
function makeApp() {
  const app = new Hono<{ Variables: { event: Record<string, unknown> } }>();
  app.use("*", requestId());
  app.use("*", async (c, next) => {
    // The auth middleware consults `c.get("event")` to record auth_method.
    c.set("event", {});
    await next();
  });
  app.route("/mcp", mcpRoute);
  return app;
}

const KEY = String(SEEDED_WORKSPACE_TEAM_ID);

function jsonRpc(body: object, key: string | undefined = KEY): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (key !== undefined) headers["x-openstatus-key"] = key;
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
  });
}

async function readJsonRpc(
  res: Response,
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    // SSE frames look like `event: message\ndata: {...}\n\n`. Pull the
    // first `data:` payload.
    const match = text.match(/data:\s*({.*})/);
    if (!match) throw new Error(`no data frame in SSE response: ${text}`);
    return JSON.parse(match[1]);
  }
  return res.json() as Promise<{
    result?: unknown;
    error?: { code: number; message: string };
  }>;
}

describe("MCP transport", () => {
  test("rejects requests missing x-openstatus-key with 401", async () => {
    const app = makeApp();
    const res = await app.fetch(jsonRpc({ method: "tools/list" }, undefined));
    expect(res.status).toBe(401);
  });

  test("tools/list returns the 8 registered tools", async () => {
    const app = makeApp();
    const res = await app.fetch(jsonRpc({ method: "tools/list" }));
    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const tools = (body.result as { tools: { name: string }[] }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_status_report_update",
      "create_maintenance",
      "create_status_report",
      "list_maintenances",
      "list_status_pages",
      "list_status_reports",
      "resolve_status_report",
      "update_status_report",
    ]);
  });

  test("tools/call list_status_pages succeeds with valid auth", async () => {
    const app = makeApp();
    const res = await app.fetch(
      jsonRpc({
        method: "tools/call",
        params: { name: "list_status_pages", arguments: {} },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    expect(body.error).toBeUndefined();
    const result = body.result as {
      structuredContent?: { items: unknown[] };
      isError?: boolean;
    };
    expect(result.isError).toBeUndefined();
    expect(Array.isArray(result.structuredContent?.items)).toBe(true);
  });

  test("tools/call with unknown tool name returns a JSON-RPC error", async () => {
    const app = makeApp();
    const res = await app.fetch(
      jsonRpc({
        method: "tools/call",
        params: { name: "definitely_not_a_tool", arguments: {} },
      }),
    );
    // The SDK either returns a JSON-RPC error (status 200, error field set)
    // or 4xx with an error. Either is acceptable; assert "not success".
    if (res.status === 200) {
      const body = await readJsonRpc(res);
      expect(body.error).toBeDefined();
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  test("tools/list advertises non-empty descriptions and schemas", async () => {
    const app = makeApp();
    const res = await app.fetch(jsonRpc({ method: "tools/list" }));
    const body = await readJsonRpc(res);
    const tools = (
      body.result as {
        tools: {
          name: string;
          description?: string;
          inputSchema?: object;
          outputSchema?: object;
        }[];
      }
    ).tools;
    expect(tools).toHaveLength(8);
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(40);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });
});

/**
 * End-to-end actor stamping — drive a real `tools/call` through
 * `app.fetch` and verify the resulting audit row has
 * `actorType: "mcp"` and a real `actorId` (the API key id captured by
 * the auth middleware, not a workspace placeholder). Distinct from the
 * unit tests, which assert this on direct handler calls — this proves
 * the entire chain (auth → toServiceCtx → tool → service → emitAudit)
 * end-to-end.
 *
 * Cannot use `withTestTransaction` here because the request goes
 * through `app.fetch` which reaches the default db. Tracks created ids
 * for `afterAll` cleanup.
 */
describe("MCP transport — audit stamping", () => {
  const E2E_PREFIX = "mcp-handler-test";
  let e2ePageId: number | null = null;
  const createdReports: number[] = [];

  beforeAll(async () => {
    const row = await db
      .insert(page)
      .values({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        title: `${E2E_PREFIX}-page`,
        description: "e2e page",
        slug: `${E2E_PREFIX}-page-slug`,
        customDomain: "",
      })
      .returning()
      .get();
    e2ePageId = row.id;
  });

  afterAll(async () => {
    for (const id of createdReports) {
      await db
        .delete(auditLog)
        .where(eq(auditLog.entityId, String(id)))
        .catch(() => undefined);
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, id))
        .catch(() => undefined);
    }
    if (e2ePageId !== null) {
      await db
        .delete(page)
        .where(eq(page.id, e2ePageId))
        .catch(() => undefined);
    }
  });

  test("tools/call create_status_report writes audit row with transport=mcp", async () => {
    const app = makeApp();
    if (e2ePageId === null) throw new Error("setup failed");
    const res = await app.fetch(
      jsonRpc({
        method: "tools/call",
        params: {
          name: "create_status_report",
          arguments: {
            title: `${E2E_PREFIX}-create`,
            status: "investigating",
            message: "e2e investigating",
            pageId: e2ePageId,
            pageComponentIds: [],
            notify: false,
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    expect(body.error).toBeUndefined();
    const result = body.result as {
      isError?: boolean;
      structuredContent?: {
        statusReport: { id: number };
      };
    };
    expect(result.isError).toBeUndefined();
    const reportId = result.structuredContent?.statusReport.id;
    expect(reportId).toBeGreaterThan(0);
    if (typeof reportId === "number") createdReports.push(reportId);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, String(reportId)))
      .all();
    const createRow = rows.find((r) => r.action === "status_report.create");
    expect(createRow).toBeDefined();
    expect(createRow?.actorType).toBe("mcp");
    // In dev mode the auth middleware sets keyId to the input key string
    // (which we set to KEY = SEEDED_WORKSPACE_TEAM_ID). So actorId reflects
    // the dev-key string, proving the real keyId is propagated end-to-end
    // and not falling back to the `ws:N` placeholder.
    expect(createRow?.actorId).toBe(KEY);
  });
});
