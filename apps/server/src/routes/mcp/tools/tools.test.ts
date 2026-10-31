import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, eq } from "@openstatus/db";
import {
  auditLog,
  monitor,
  page,
  pageComponent,
  pageSubscriber,
  privateLocation,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Scope, Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import { SEEDED_WORKSPACE_FREE_ID } from "@openstatus/services/test/fixtures";
import {
  expectAuditRow,
  createWorkspaceFixture,
  readAuditLog,
  withTestTransaction,
} from "@openstatus/services/test/helpers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { toServiceCtx } from "../adapter";
import { registerMaintenanceTools } from "./maintenance";
import { registerMonitorTools } from "./monitor";
import { registerPageTools } from "./page";
import { registerPrivateLocationTools } from "./private-location";
import { registerStatusReportTools } from "./status-report";
import { registerWorkspaceTools } from "./workspace";

/**
 * Build an MCP-flavoured `ServiceContext` for a workspace, optionally
 * threading a transaction through `ctx.db` so writes can be rolled back
 * via `withTestTransaction`. Local to this test file — distinct from
 * `makeMcpCtx` in `@openstatus/services/test/helpers`, which doesn't
 * thread a tx and exists for service-package tests.
 */
function makeMcpToolCtx(
  workspace: Workspace,
  opts: {
    db?: ServiceContext["db"];
    createdById?: number;
    scopes?: Scope[];
  } = {},
): ServiceContext {
  return {
    ...toServiceCtx({
      workspace,
      apiKey: {
        id: "test-key",
        createdById: opts.createdById,
        scopes: opts.scopes ?? ["write"],
      },
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
  teamWorkspace = (await createWorkspaceFixture("team")).workspace;
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
  group:
    | "page"
    | "status-report"
    | "maintenance"
    | "monitor"
    | "private-location"
    | "workspace",
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
    case "monitor":
      return registerMonitorTools(server, ctx);
    case "workspace":
      return registerWorkspaceTools(server, ctx);
    case "private-location":
      return registerPrivateLocationTools(server, ctx);
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
  } as any;
  return (tool.handler as any)(args, extra);
}

describe("list_status_pages", () => {
  test("lists pages in the workspace, slim shape", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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

      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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

  test("returns the full timeline newest-first with update ids", async () => {
    await withTestTransaction(async (tx) => {
      const sr = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-timeline`,
          status: "identified",
        })
        .returning()
        .get();
      // RETURNING order is unspecified, so pick the rows by date
      const rows = await tx
        .insert(statusReportUpdate)
        .values([
          {
            statusReportId: sr.id,
            status: "investigating",
            message: "first",
            date: new Date("2026-01-01T00:00:00Z"),
          },
          {
            statusReportId: sr.id,
            status: "identified",
            message: "second",
            date: new Date("2026-01-02T00:00:00Z"),
          },
        ])
        .returning()
        .all();
      const [older, newer] = [...rows].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );

      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "list_status_reports", {});
      expect(result.isError).toBeUndefined();
      const items = (
        result.structuredContent as {
          items: {
            id: number;
            latestUpdate: { id: number } | null;
            updates: { id: number; status: string; message: string }[];
          }[];
        }
      ).items;
      const item = items.find((i) => i.id === sr.id);
      expect(item?.updates.map((u) => u.id)).toEqual([newer.id, older.id]);
      expect(item?.updates[0].status).toBe("identified");
      expect(item?.latestUpdate?.id).toBe(newer.id);
    });
  });
});

describe("get_status_report", () => {
  test("returns every update id, past the list cap", async () => {
    await withTestTransaction(async (tx) => {
      const sr = await tx
        .insert(statusReport)
        .values({
          workspaceId: teamWorkspace.id,
          pageId: testPageId,
          title: `${TEST_PREFIX}-long`,
          status: "investigating",
        })
        .returning()
        .get();
      const rows = await tx
        .insert(statusReportUpdate)
        .values(
          Array.from({ length: 12 }, (_, i) => ({
            statusReportId: sr.id,
            status: "investigating" as const,
            message: `update ${i}`,
            date: new Date(Date.UTC(2026, 0, 1 + i)),
          })),
        )
        .returning()
        .all();
      const newestFirst = [...rows]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((u) => u.id);

      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const listed = await callTool(tools, "list_status_reports", {});
      const item = (
        listed.structuredContent as {
          items: { id: number; updates: { id: number }[] }[];
        }
      ).items.find((i) => i.id === sr.id);
      expect(item?.updates.map((u) => u.id)).toEqual(newestFirst.slice(0, 10));

      const result = await callTool(tools, "get_status_report", { id: sr.id });
      expect(result.isError).toBeUndefined();
      const report = result.structuredContent as {
        id: number;
        updates: { id: number }[];
      };
      expect(report.id).toBe(sr.id);
      expect(report.updates.map((u) => u.id)).toEqual(newestFirst);
    });
  });

  test("errors for a report outside the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const other = await tx
        .insert(statusReport)
        .values({
          workspaceId: SEEDED_WORKSPACE_FREE_ID,
          title: `${TEST_PREFIX}-other-ws-report`,
          status: "investigating",
        })
        .returning()
        .get();

      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("status-report", ctx);
      const result = await callTool(tools, "get_status_report", {
        id: other.id,
      });
      expect(result.isError).toBe(true);
    });
  });
});

describe("create_status_report", () => {
  test("creates a report + initial update and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx, createdById: 1 });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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

  // The "rejects status: 'resolved'" guarantee is enforced by a Zod
  // refine on the input schema — see handler.test.ts for the
  // integration test that exercises it via a real `tools/call`. A
  // handler-direct invocation here bypasses the SDK's input
  // validation step, so the refine doesn't fire.
});

describe("resolve_status_report", () => {
  test("resolves an active report and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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

describe("update_status_report_update / delete_status_report_update", () => {
  async function seedReport(tx: ServiceContext["db"]) {
    const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
    const tools = registered("status-report", ctx);
    const created = await callTool(tools, "create_status_report", {
      title: `${TEST_PREFIX}-edit-updates`,
      status: "investigating",
      message: "first",
      pageId: testPageId,
      pageComponentIds: [testPageComponentId],
      notify: false,
    });
    expect(created.isError).toBeUndefined();
    const { statusReport: sr, initialUpdateId } = created.structuredContent as {
      statusReport: { id: number };
      initialUpdateId: number;
    };
    return { tools, reportId: sr.id, firstUpdateId: initialUpdateId };
  }

  test("edits an entry and re-derives the report status", async () => {
    await withTestTransaction(async (tx) => {
      const { tools, reportId, firstUpdateId } = await seedReport(tx);
      const added = await callTool(tools, "add_status_report_update", {
        statusReportId: reportId,
        status: "identified",
        message: "second",
        notify: false,
      });
      const { statusReportUpdateId } = added.structuredContent as {
        statusReportUpdateId: number;
      };

      const edited = await callTool(tools, "update_status_report_update", {
        id: statusReportUpdateId,
        status: "monitoring",
        message: "second, corrected",
      });
      expect(edited.isError).toBeUndefined();
      const out = edited.structuredContent as {
        id: number;
        statusReportId: number;
        status: string;
        message: string;
      };
      expect(out.id).toBe(statusReportUpdateId);
      expect(out.statusReportId).toBe(reportId);
      expect(out.status).toBe("monitoring");
      expect(out.message).toBe("second, corrected");

      const report = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, reportId))
        .get();
      expect(report?.status).toBe("monitoring");
      expect(firstUpdateId).toBeGreaterThan(0);
    });
  });

  test("setting the latest entry to 'resolved' resolves the report", async () => {
    await withTestTransaction(async (tx) => {
      const { tools, reportId, firstUpdateId } = await seedReport(tx);
      const result = await callTool(tools, "update_status_report_update", {
        id: firstUpdateId,
        status: "resolved",
      });
      expect(result.isError).toBeUndefined();
      expect((result.structuredContent as { status: string }).status).toBe(
        "resolved",
      );

      const report = await tx
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, reportId))
        .get();
      expect(report?.status).toBe("resolved");
    });
  });

  test("deletes a non-last entry and refuses the last one", async () => {
    await withTestTransaction(async (tx) => {
      const { tools, reportId, firstUpdateId } = await seedReport(tx);
      const added = await callTool(tools, "add_status_report_update", {
        statusReportId: reportId,
        status: "identified",
        message: "second",
        notify: false,
      });
      const { statusReportUpdateId } = added.structuredContent as {
        statusReportUpdateId: number;
      };

      const deleted = await callTool(tools, "delete_status_report_update", {
        id: statusReportUpdateId,
      });
      expect(deleted.isError).toBeUndefined();
      expect(deleted.structuredContent).toEqual({
        id: statusReportUpdateId,
        success: true,
      });
      const rows = await readAuditLog({
        workspaceId: teamWorkspace.id,
        entityType: "status_report_update",
        entityId: statusReportUpdateId,
        db: tx,
      });
      expect(rows.some((r) => r.action === "status_report_update.delete")).toBe(
        true,
      );

      const last = await callTool(tools, "delete_status_report_update", {
        id: firstUpdateId,
      });
      expect(last.isError).toBe(true);
      expect(JSON.stringify(last.content)).toContain("at least one update");
      const remaining = await tx
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, reportId))
        .all();
      expect(remaining).toHaveLength(1);
    });
  });
});

describe("list_maintenances", () => {
  test("returns items and pagination metadata", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("maintenance", ctx);
      const result = await callTool(tools, "list_maintenances", {});
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        items: unknown[];
        pagination: {
          page: number;
          perPage: number;
          totalSize: number;
          totalPages: number;
        };
      };
      expect(Array.isArray(out.items)).toBe(true);
      expect(out.pagination.page).toBe(1);
      expect(out.pagination.perPage).toBe(50);
      expect(typeof out.pagination.totalSize).toBe("number");
      expect(out.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  test("respects page and perPage inputs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("maintenance", ctx);
      const result = await callTool(tools, "list_maintenances", {
        page: 2,
        perPage: 10,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        pagination: { page: number; perPage: number };
      };
      expect(out.pagination.page).toBe(2);
      expect(out.pagination.perPage).toBe(10);
    });
  });
});

describe("create_maintenance", () => {
  test("creates a maintenance window and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
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

describe("list_private_locations", () => {
  test("never exposes the agent token", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      await tx.insert(privateLocation).values({
        name: `${TEST_PREFIX}-mcp-location`,
        token: "super-secret-agent-token",
        workspaceId: teamWorkspace.id,
      });

      const tools = registered("private-location", ctx);
      const result = await callTool(tools, "list_private_locations", {
        page: 1,
        perPage: 50,
      });

      expect(result.isError).toBeFalsy();

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("super-secret-agent-token");
      expect(serialized).not.toContain("token");
    });
  });

  test("returns locations for the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      await tx.insert(privateLocation).values({
        name: `${TEST_PREFIX}-mcp-listed`,
        token: "another-token",
        workspaceId: teamWorkspace.id,
      });

      const tools = registered("private-location", ctx);
      const result = await callTool(tools, "list_private_locations", {
        page: 1,
        perPage: 50,
      });

      const structured = result.structuredContent as {
        items: { name: string }[];
      };
      expect(structured.items.some((i) => i.name.includes("mcp-listed"))).toBe(
        true,
      );
    });
  });
});

describe("get_workspace", () => {
  test("returns plan and usage without billing identifiers", async () => {
    await withTestTransaction(async (tx) => {
      // fixture workspace already holds one page + one component; a
      // soft-deleted monitor must not count
      await tx.insert(monitor).values([
        {
          workspaceId: teamWorkspace.id,
          url: "https://example.openstatus.dev",
          name: `${TEST_PREFIX}-monitor`,
        },
        {
          workspaceId: teamWorkspace.id,
          url: "https://example.openstatus.dev",
          name: `${TEST_PREFIX}-monitor-deleted`,
          deletedAt: new Date(),
        },
      ]);
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("workspace", ctx);
      const result = await callTool(tools, "get_workspace", {});

      expect(result.isError).toBeFalsy();
      const structured = result.structuredContent as {
        id: number;
        slug: string;
        name: string | null;
        plan: string;
        trialEndsAt: string | null;
        usage: {
          monitors: number;
          statusPages: number;
          pageComponents: number;
          notificationChannels: number;
          statusReports: number;
        };
      };
      expect(structured.id).toBe(teamWorkspace.id);
      expect(structured.slug).toBe(teamWorkspace.slug);
      expect(structured.name).toBe(teamWorkspace.name ?? null);
      expect(structured.plan).toBe(teamWorkspace.plan);
      expect(structured.trialEndsAt).toBe(
        teamWorkspace.trialEndsAt?.toISOString() ?? null,
      );
      expect(structured.usage).toEqual({
        monitors: 1,
        statusPages: 1,
        pageComponents: 1,
        notificationChannels: 0,
        statusReports: 0,
      });

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("stripe");
      expect(serialized).not.toContain("subscription");
      expect(serialized).not.toContain('"limits"');
    });
  });
});

describe("create_status_page", () => {
  test("creates a page with its public url and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const slug = `${TEST_PREFIX}-created-${Date.now()}`;
      const result = await callTool(tools, "create_status_page", {
        title: `${TEST_PREFIX}-created`,
        slug,
        description: "Acme services",
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        id: number;
        slug: string;
        url: string;
        dashboardUrl: string;
      };
      expect(out.id).toBeGreaterThan(0);
      expect(out.slug).toBe(slug);
      expect(out.url).toBe(`https://${slug}.openstatus.dev`);
      expect(out.dashboardUrl).toContain(`/status-pages/${out.id}/`);
      await expectAuditRow({
        workspaceId: teamWorkspace.id,
        action: "page.create",
        entityType: "page",
        entityId: out.id,
        actorType: "mcp",
        db: tx,
      });
    });
  });

  test("returns isError: true for a taken slug (CONFLICT)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const result = await callTool(tools, "create_status_page", {
        title: "dup",
        slug: `${TEST_PREFIX}-page-slug`,
      });
      expect(result.isError).toBe(true);
    });
  });
});

describe("add_page_component", () => {
  test("appends a monitor component and emits audit with transport=mcp", async () => {
    await withTestTransaction(async (tx) => {
      const m = await tx
        .insert(monitor)
        .values({
          workspaceId: teamWorkspace.id,
          active: true,
          url: "https://example.com",
          name: `${TEST_PREFIX}-component-monitor`,
          method: "GET",
          periodicity: "10m",
          regions: "ams",
        })
        .returning()
        .get();

      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const result = await callTool(tools, "add_page_component", {
        pageId: testPageId,
        monitorId: m.id,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        id: number;
        pageId: number;
        monitorId: number;
        name: string;
        order: number;
      };
      expect(out).toMatchObject({
        pageId: testPageId,
        monitorId: m.id,
        name: m.name,
      });
      // The fixture component sits at order 0; the new one is appended.
      expect(out.order).toBe(1);
      await expectAuditRow({
        workspaceId: teamWorkspace.id,
        action: "page_component.create",
        entityType: "page_component",
        entityId: out.id,
        actorType: "mcp",
        db: tx,
      });

      const again = await callTool(tools, "add_page_component", {
        pageId: testPageId,
        monitorId: m.id,
      });
      expect(again.isError).toBe(true);
    });
  });
});

describe("create_monitor", () => {
  const originalFetch = globalThis.fetch;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ state: "success", status: 200, latency: 90 }),
        { headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    if (originalCronSecret === undefined) {
      process.env.CRON_SECRET = undefined;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  test("creates an http monitor, probes its first region and emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("monitor", ctx);
      const result = await callTool(tools, "create_monitor", {
        name: `${TEST_PREFIX}-monitor`,
        url: "https://example.com/health",
        jobType: "http",
        method: "GET",
        active: true,
      });
      expect(result.isError).toBeUndefined();
      const out = result.structuredContent as {
        monitor: {
          id: number;
          regions: string[];
          active: boolean;
          dashboardUrl: string;
        };
        firstCheck: { region: string; state: string; status?: number } | null;
      };
      expect(out.monitor.id).toBeGreaterThan(0);
      expect(out.monitor.active).toBe(true);
      expect(out.monitor.regions.length).toBeGreaterThan(0);
      expect(out.monitor.dashboardUrl).toContain(
        `/monitors/${out.monitor.id}/overview`,
      );
      expect(out.firstCheck).toMatchObject({
        region: out.monitor.regions[0],
        state: "success",
        status: 200,
      });
      await expectAuditRow({
        workspaceId: teamWorkspace.id,
        action: "monitor.create",
        entityType: "monitor",
        entityId: out.monitor.id,
        actorType: "mcp",
        db: tx,
      });
    });
  });

  test("tcp monitors get no first check", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("monitor", ctx);
      const result = await callTool(tools, "create_monitor", {
        name: `${TEST_PREFIX}-tcp`,
        url: "example.com:443",
        jobType: "tcp",
      });
      expect(result.isError).toBeUndefined();
      expect(
        (result.structuredContent as { firstCheck: unknown }).firstCheck,
      ).toBeNull();
    });
  });

  test("a monitors:read key does not see create_monitor", () => {
    const ctx = makeMcpToolCtx(teamWorkspace, { scopes: ["monitors:read"] });
    const tools = registered("monitor", ctx);
    expect(tools.has("list_monitors")).toBe(true);
    expect(tools.has("create_monitor")).toBe(false);
    expect(registered("page", ctx).has("list_status_pages")).toBe(false);
  });

  test("a monitors:write key sees create_monitor but no page tools", () => {
    const ctx = makeMcpToolCtx(teamWorkspace, { scopes: ["monitors:write"] });
    expect(registered("monitor", ctx).has("create_monitor")).toBe(true);
    expect(registered("page", ctx).has("add_page_component")).toBe(false);
  });
});

describe("create budget", () => {
  test("stops the 31st create of the hour for one key", async () => {
    await withTestTransaction(async (tx) => {
      await tx.insert(auditLog).values(
        Array.from({ length: 30 }, (_, i) => ({
          workspaceId: teamWorkspace.id,
          actorType: "mcp",
          actorId: "test-key",
          action: "monitor.create",
          entityType: "monitor",
          entityId: String(i + 1),
        })),
      );
      const ctx = makeMcpToolCtx(teamWorkspace, { db: tx });
      const tools = registered("page", ctx);
      const result = await callTool(tools, "create_status_page", {
        title: "over budget",
        slug: `${TEST_PREFIX}-budget-${Date.now()}`,
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("30");
    });
  });
});

describe("scope filter", () => {
  test("read-only key sees read tools, no write tools", async () => {
    const ctx = makeMcpToolCtx(teamWorkspace, { scopes: ["read"] });
    const pageTools = registered("page", ctx);
    const reportTools = registered("status-report", ctx);
    const maintenanceTools = registered("maintenance", ctx);

    // Read-only is allowed:
    expect(pageTools.has("list_status_pages")).toBe(true);
    expect(reportTools.has("list_status_reports")).toBe(true);
    expect(maintenanceTools.has("list_maintenances")).toBe(true);
    expect(
      registered("private-location", ctx).has("list_private_locations"),
    ).toBe(true);

    // Write tools must be filtered out — registry doesn't carry them
    // and `tools/list` will see only the read tools.
    expect(reportTools.has("create_status_report")).toBe(false);
    expect(reportTools.has("add_status_report_update")).toBe(false);
    expect(reportTools.has("update_status_report")).toBe(false);
    expect(reportTools.has("resolve_status_report")).toBe(false);
    expect(reportTools.has("update_status_report_update")).toBe(false);
    expect(reportTools.has("delete_status_report_update")).toBe(false);
    expect(maintenanceTools.has("create_maintenance")).toBe(false);
    expect(maintenanceTools.has("add_maintenance_update")).toBe(false);
    expect(maintenanceTools.has("update_maintenance_update")).toBe(false);
    expect(maintenanceTools.has("delete_maintenance_update")).toBe(false);
  });

  test("write key sees both read and write tools", () => {
    const ctx = makeMcpToolCtx(teamWorkspace, { scopes: ["write"] });
    const reportTools = registered("status-report", ctx);
    expect(reportTools.has("list_status_reports")).toBe(true);
    expect(reportTools.has("create_status_report")).toBe(true);
  });

  test("'*' (super-admin) key sees every tool", () => {
    const ctx = makeMcpToolCtx(teamWorkspace, { scopes: ["*"] });
    const reportTools = registered("status-report", ctx);
    expect(reportTools.has("list_status_reports")).toBe(true);
    expect(reportTools.has("create_status_report")).toBe(true);
    expect(reportTools.has("resolve_status_report")).toBe(true);
  });
});
