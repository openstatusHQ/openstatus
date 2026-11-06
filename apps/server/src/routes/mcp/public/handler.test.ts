import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { describe, expect, test } from "vitest";

import { handleError } from "../../../libs/errors";
import { mcpRoute } from "../index";
import { publicStatusMcpRoute } from "./index";

// Same order as production: the public route must win over `/mcp`'s auth.
function makeApp() {
  const app = new Hono<{ Variables: { event: Record<string, unknown> } }>();
  app.use("*", sentry({ dsn: undefined }));
  app.use("*", requestId());
  app.use("*", async (c, next) => {
    c.set("event", {});
    await next();
  });
  app.onError(handleError);
  app.route("/mcp/status", publicStatusMcpRoute);
  app.route("/mcp", mcpRoute);
  return app;
}

function rpc(path: string, body: object): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
  });
}

type RpcBody = {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

async function readJsonRpc(res: Response): Promise<RpcBody> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const match = (await res.text()).match(/data:\s*({.*})/);
    if (!match) throw new Error("no data frame in SSE response");
    return JSON.parse(match[1]);
  }
  return res.json() as Promise<RpcBody>;
}

describe("anonymous /mcp/status", () => {
  test("initialize answers without a credential", async () => {
    const res = await makeApp().fetch(
      rpc("/mcp/status", {
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "0" },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const info = body.result?.serverInfo as { name: string };
    expect(info.name).toBe("openstatus-status");
    expect(body.result?.instructions).toContain("get_service_status");
  });

  test("lists only the read-only status tools", async () => {
    const res = await makeApp().fetch(
      rpc("/mcp/status", { method: "tools/list" }),
    );
    const body = await readJsonRpc(res);
    const tools = body.result?.tools as {
      name: string;
      annotations: { readOnlyHint: boolean };
    }[];
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_service_status",
      "list_active_issues",
    ]);
    expect(tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
  });

  test("an unknown service is a normal answer, not an error", async () => {
    const res = await makeApp().fetch(
      rpc("/mcp/status", {
        method: "tools/call",
        params: {
          name: "get_service_status",
          arguments: { service: "definitely-not-tracked-xyz" },
        },
      }),
    );
    const body = await readJsonRpc(res);
    const result = body.result as {
      isError?: boolean;
      structuredContent: { found: boolean };
    };
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.found).toBe(false);
  });

  test("the signed-in /mcp still demands a credential", async () => {
    const res = await makeApp().fetch(rpc("/mcp", { method: "tools/list" }));
    expect(res.status).toBe(401);
  });

  test("a browser is sent to the status page", async () => {
    const res = await makeApp().fetch(
      new Request("http://localhost/mcp/status", {
        headers: { Accept: "text/html" },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://www.openstatus.dev/status",
    );
  });
});
