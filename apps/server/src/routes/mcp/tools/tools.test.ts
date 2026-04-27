import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "@openstatus/services/test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  readAuditLog,
  withTestTransaction,
} from "@openstatus/services/test/helpers";

import { toServiceCtx } from "../adapter";
import { registerMaintenanceTools } from "./maintenance";
import { registerPageTools } from "./page";
import { registerStatusReportTools } from "./status-report";

/**
 * Build an MCP-flavoured `ServiceContext` for a workspace, optionally
 * threading a transaction through `ctx.db` so writes can be rolled back
 * via `withTestTransaction`.
 */
function makeMcpCtx(
  workspace: Workspace,
  opts: {
    db?: ServiceContext["db"];
    createdById?: number;
  } = {},
): ServiceContext {
  return {
    ...toServiceCtx({
      workspace,
      apiKey: { id: "test-key", createdById: opts.createdById },
      requestId: "test-req",
    }),
    db: opts.db,
  };
}

const TEST_PREFIX = "mcp-tool-test";

let teamWorkspace: Workspace;
let testPageId: number;
let testPageComponentId: number;

beforeAll(async () => {
  teamWorkspace = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const pageRow = await db
    .insert(page)
    .values({
      workspaceId: teamWorkspace.id,
      title: `${TEST_PREFIX}-page`,
      description: "test page",
      slug: `${TEST_PREFIX}-page-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = pageRow.id;

  const componentRow = await db
    .insert(pageComponent)
    .values({
      workspaceId: teamWorkspace.id,
      pageId: testPageId,
      name: `${TEST_PREFIX}-component`,
      type: "static",
    })
    .returning()
    .get();
  testPageComponentId = componentRow.id;
});

afterAll(async () => {
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.pageId, testPageId))
    .catch(() => undefined);
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.id, testPageComponentId))
    .catch(() => undefined);
  await db
    .delete(page)
    .where(eq(page.id, testPageId))
    .catch(() => undefined);
});

/** Build a fresh McpServer + register a tool group, return the tool map. */
function registered(
  group: "page" | "status-report" | "maintenance",
  ctx: ServiceContext,
) {
  const server = new McpServer(
    { name: "test", version: "0.0.0" },
    { capabilities: { tools: { listChanged: false } } },
  );
  switch (group) {
    case "page":
      return registerPageTools(server, ctx);
    case "status-report":
      return registerStatusReportTools(server, ctx);
    case "maintenance":
      return registerMaintenanceTools(server, ctx);
  }
}

/** Invoke a tool's registered handler with input args. Returns the CallToolResult. */
async function callTool(
  toolMap: ReturnType<typeof registered>,
  name: string,
  args: Record<string, unknown>,
): Promise<{
  structuredContent?: unknown;
  isError?: boolean;
  content: unknown;
}> {
  const tool = toolMap.get(name);
  if (!tool) throw new Error(`tool ${name} not registered`);
  // The SDK's `RegisteredTool.handler` signature accepts (args, extra) —
  // we provide a minimal extra suitable for unit tests.
  const extra = {
    signal: new AbortController().signal,
    requestId: "test-req",
    sendNotification: async () => undefined,
    sendRequest: async () => undefined as never,
    // biome-ignore lint/suspicious/noExplicitAny: SDK types not relevant for unit test
  } as any;
  // biome-ignore lint/suspicious/noExplicitAny: handler is dynamically typed by the SDK
  return (tool.handler as any)(args, extra);
}

describe("list_status_pages", () => {
  test("lists pages in the workspace, slim shape", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const result = await callTool(tools, "list_status_pages", {});
      expect(result.isError).toBeUndefined();
      const items = (result.structuredContent as { items: unknown[] }).items;
      expect(Array.isArray(items)).toBe(true);
      const ids = items.map((i) => (i as { id: number }).id);
      expect(ids).toContain(testPageId);
      // slim shape: must NOT carry password / customDomain etc.
      const ourPage = items.find(
        (i) => (i as { id: number }).id === testPageId,
      );
      expect(Object.keys(ourPage as object).sort()).toEqual([
        "id",
        "slug",
        "title",
      ]);
    });
  });

  test("does not leak pages from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      // Insert a page in the FREE workspace using the same tx.
      const otherPage = await tx
        .insert(page)
        .values({
          workspaceId: SEEDED_WORKSPACE_FREE_ID,
          title: `${TEST_PREFIX}-other-ws`,
          description: "should be invisible",
          slug: `${TEST_PREFIX}-other-ws-slug`,
          customDomain: "",
        })
        .returning()
        .get();

      // Call list_status_pages as the TEAM workspace.
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const result = await callTool(tools, "list_status_pages", {});
      const items = (result.structuredContent as { items: { id: number }[] })
        .items;
      const ids = items.map((i) => i.id);
      expect(ids).not.toContain(otherPage.id);
    });
  });
});

describe("list_status_reports", () => {
  test("filters out resolved reports by default", async () => {
    await withTestTransaction(async (tx) => {
      // seed: one active + one resolved
      const active = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-active`,
          status: "investigating",
        })
        .returning()
        .get();
      const resolved = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-resolved`,
          status: "resolved",
        })
        .returning()
        .get();

      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "list_status_reports", {
        filter: "active",
      });
      expect(result.isError).toBeUndefined();
      const items = (result.structuredContent as { items: { id: number }[] })
        .items;
      const ids = items.map((i) => i.id);
      expect(ids).toContain(active.id);
      expect(ids).not.toContain(resolved.id);
    });
  });
});

describe("create_status_report", () => {
  test("creates a report + initial update and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "create_status_report", {
        title: `${TEST_PREFIX}-create`,
        status: "investigating",
        message: "investigating slowdown",
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
        notify: false,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        statusReport: { id: number; title: string };
        initialUpdateId: number;
      };
      expect(out.statusReport.id).toBeGreaterThan(0);
      expect(out.statusReport.title).toBe(`${TEST_PREFIX}-create`);
      expect(out.initialUpdateId).toBeGreaterThan(0);

      await expectAuditRow({
        workspaceId: teamWorkspace.id,
        action: "status_report.create",
        entityType: "status_report",
        entityId: out.statusReport.id,
        actorType: "mcp",
        db: tx,
      });

      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report",
        entityId: out.statusReport.id,
        db: tx,
      });
      expect(rows[0]?.actorType).toBe("mcp");
      expect(rows[0]?.actorId).toBe("test-key");
      // No createdById on the test ctx → actorUserId stays null.
      expect(rows[0]?.actorUserId).toBeNull();
      // notify defaulted false → no dispatch
      expect(out).toMatchObject({ notified: false });
    });
  });

  test("propagates createdById to audit_log.actor_user_id", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx, createdById: 1 });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "create_status_report", {
        title: `${TEST_PREFIX}-with-creator`,
        status: "investigating",
        message: "x",
        pageId: testPageId,
        pageComponentIds: [],
        notify: false,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        statusReport: { id: number };
      };
      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report",
        entityId: out.statusReport.id,
        db: tx,
      });
      expect(rows[0]?.actorUserId).toBe(1);
    });
  });

  test("notify: true reports notified back to caller", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "create_status_report", {
        title: `${TEST_PREFIX}-create-notify`,
        status: "investigating",
        message: "investigating slowdown",
        pageId: testPageId,
        pageComponentIds: [],
        notify: true,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as { notified: boolean };
      // The team workspace's plan may or may not enable status-subscribers,
      // but the notify call must run; the tool reports `notified: true`
      // regardless of plan-level no-op behaviour inside the service.
      expect(out.notified).toBe(true);
    });
  });

  test("returns isError: true when pageId is not in workspace (NOT_FOUND)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "create_status_report", {
        title: `${TEST_PREFIX}-bad-page`,
        status: "investigating",
        message: "x",
        pageId: 9_999_999,
        pageComponentIds: [],
        notify: false,
      });
      expect(result.isError).toBe(true);
    });
  });

  // The "rejects calls that omit `notify`" guarantee belongs to the
  // SDK's input-validation step — exercised in handler.test.ts via the
  // real `tools/call` JSON-RPC envelope. A handler-direct invocation
  // (this file's pattern) bypasses that validation, so a unit test
  // here can't catch the missing-required-field case.
});

describe("add_status_report_update", () => {
  test("appends an update and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const sr = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-add-update`,
          status: "investigating",
        })
        .returning()
        .get();

      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "add_status_report_update", {
        statusReportId: sr.id,
        status: "identified",
        message: "found root cause",
        notify: false,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as { statusReportUpdateId: number };
      expect(out.statusReportUpdateId).toBeGreaterThan(0);

      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report_update",
        entityId: out.statusReportUpdateId,
        db: tx,
      });
      expect(rows[0]?.action).toBe("status_report_update.create");
      expect(rows[0]?.actorType).toBe("mcp");
      expect(rows[0]?.actorId).toBe("test-key");
    });
  });
});

describe("update_status_report", () => {
  test("edits a report's title and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const sr = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-orig`,
          status: "investigating",
        })
        .returning()
        .get();

      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "update_status_report", {
        statusReportId: sr.id,
        title: `${TEST_PREFIX}-edited`,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as { id: number; title: string };
      expect(out.title).toBe(`${TEST_PREFIX}-edited`);

      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report",
        entityId: out.id,
        db: tx,
      });
      expect(rows[0]?.action).toBe("status_report.update");
      expect(rows[0]?.actorType).toBe("mcp");
      expect(rows[0]?.actorId).toBe("test-key");
    });
  });
});

describe("resolve_status_report", () => {
  test("resolves an active report and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const sr = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-resolve`,
          status: "investigating",
        })
        .returning()
        .get();

      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "resolve_status_report", {
        statusReportId: sr.id,
        message: "fixed",
        notify: false,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as { statusReportUpdateId: number };
      expect(out.statusReportUpdateId).toBeGreaterThan(0);

      // Resolution path goes through addStatusReportUpdate which writes
      // a status_report_update.create audit row.
      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report_update",
        entityId: out.statusReportUpdateId,
        db: tx,
      });
      expect(rows[0]?.actorType).toBe("mcp");
      expect(rows[0]?.actorId).toBe("test-key");
      // confirm the report itself flipped to resolved
      const after = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, sr.id))
        .get();
      expect(after?.status).toBe("resolved");
      // tidy up the inserted update row to keep the rolled-back tx tidy
      await tx
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, sr.id))
        .catch(() => undefined);
    });
  });
});

describe("list_maintenances", () => {
  test("lists maintenances in the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("maintenance", ctx);
      const result = await callTool(tools, "list_maintenances", {});
      expect(result.isError).toBeUndefined();
      expect(
        Array.isArray((result.structuredContent as { items: unknown[] }).items),
      ).toBe(true);
    });
  });
});

describe("create_maintenance", () => {
  test("creates a maintenance window and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("maintenance", ctx);
      const from = new Date("2026-04-30T14:00:00Z").toISOString();
      const to = new Date("2026-04-30T15:00:00Z").toISOString();
      const result = await callTool(tools, "create_maintenance", {
        title: `${TEST_PREFIX}-mtc`,
        message: "scheduled work",
        from,
        to,
        pageId: testPageId,
        pageComponentIds: [testPageComponentId],
        notify: false,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as { id: number; title: string };
      expect(out.id).toBeGreaterThan(0);
      expect(out.title).toBe(`${TEST_PREFIX}-mtc`);

      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "maintenance",
        entityId: out.id,
        db: tx,
      });
      expect(rows[0]?.action).toBe("maintenance.create");
      expect(rows[0]?.actorType).toBe("mcp");
      expect(rows[0]?.actorId).toBe("test-key");
    });
  });

  test("returns isError: true when from > to (VALIDATION)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpCtx(teamWorkspace, { db: tx });
      const tools = registered("maintenance", ctx);
      const from = new Date("2026-04-30T15:00:00Z").toISOString();
      const to = new Date("2026-04-30T14:00:00Z").toISOString();
      const result = await callTool(tools, "create_maintenance", {
        title: `${TEST_PREFIX}-bad-range`,
        message: "x",
        from,
        to,
        pageId: testPageId,
        pageComponentIds: [],
        notify: false,
      });
      expect(result.isError).toBe(true);
    });
  });
});
