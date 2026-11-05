import {
  page,
  pageComponent,
  pageComponentGroup,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { type AnyAgentTool, agentTools, loadApprovalBefore } from "../index";

const TEST_PREFIX = "agent-tools-approval-before-test";

// Same map as the dashboard's registry.test.tsx, which checks that the
// approval card sends this field.
const BEFORE_ID_FIELDS: Record<string, string> = {
  update_status_page: "pageId",
  update_page_component: "componentId",
  update_component_group: "groupId",
  update_monitor: "monitorId",
  update_status_report: "statusReportId",
  update_status_report_update: "id",
  update_maintenance: "maintenanceId",
  update_maintenance_update: "id",
  update_incident: "id",
};

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  const other = (await createWorkspaceFixture("team")).workspace;
  otherCtx = makeUserCtx(other, { userId: 1 });
});

describe("approval loadBefore", () => {
  test("every update tool loads its entity by an integer id field", () => {
    for (const tool of Object.values(agentTools) as AnyAgentTool[]) {
      const idField = tool.approval?.loadBefore?.idField;
      expect(idField, tool.name).toBe(BEFORE_ID_FIELDS[tool.name]);
      if (idField) {
        expect(tool.inputSchema.shape[idField], tool.name).toBeDefined();
      }
    }
  });

  test("returns the page's current values and label", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: "Test Slack",
          description: "",
          slug: `${TEST_PREFIX}-slug`,
          customDomain: "",
        })
        .returning()
        .get();

      const before = await loadApprovalBefore({
        ctx,
        input: {
          toolName: "update_status_page",
          ids: { pageId: row.id },
        },
      });
      expect(before?.label).toBe(
        `Test Slack · ${TEST_PREFIX}-slug.openstatus.dev`,
      );
      expect(before?.values).toMatchObject({
        title: "Test Slack",
        slug: `${TEST_PREFIX}-slug`,
      });
    });
  });

  test("returns null for a missing entity, missing id or tool without a loader", async () => {
    expect(
      await loadApprovalBefore({
        ctx: teamCtx,
        input: { toolName: "update_status_page", ids: { pageId: 999_999_999 } },
      }),
    ).toBeNull();
    expect(
      await loadApprovalBefore({
        ctx: teamCtx,
        input: { toolName: "update_status_page", ids: {} },
      }),
    ).toBeNull();
    expect(
      await loadApprovalBefore({
        ctx: teamCtx,
        input: { toolName: "create_status_page", ids: {} },
      }),
    ).toBeNull();
    expect(
      await loadApprovalBefore({
        ctx: teamCtx,
        input: { toolName: "toString", ids: {} },
      }),
    ).toBeNull();
  });

  test("returns null for another workspace's entity", async () => {
    await withTestTransaction(async (tx) => {
      const row = await tx
        .insert(page)
        .values({
          workspaceId: otherCtx.workspace.id,
          title: "Other",
          description: "",
          slug: `${TEST_PREFIX}-other`,
          customDomain: "",
        })
        .returning()
        .get();
      expect(
        await loadApprovalBefore({
          ctx: { ...teamCtx, db: tx },
          input: { toolName: "update_status_page", ids: { pageId: row.id } },
        }),
      ).toBeNull();
    });
  });

  test("returns null for a tool the workspace is not offered", async () => {
    const tool = agentTools.update_status_page as AnyAgentTool;
    // No feature exists yet; an unknown one is never enabled.
    tool.feature = `${TEST_PREFIX}-feature` as never;
    try {
      expect(
        await loadApprovalBefore({
          ctx: teamCtx,
          input: { toolName: "update_status_page", ids: { pageId: 1 } },
        }),
      ).toBeNull();
    } finally {
      delete tool.feature;
    }
  });

  test("a grouped component's order is its place among siblings", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const workspaceId = ctx.workspace.id;
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId,
          title: "Grouped",
          description: "",
          slug: `${TEST_PREFIX}-grouped`,
          customDomain: "",
        })
        .returning()
        .get();
      const group = await tx
        .insert(pageComponentGroup)
        .values({ workspaceId, pageId: pageRow.id, name: "Core" })
        .returning()
        .get();
      const insert = (name: string, groupOrder: number) =>
        tx
          .insert(pageComponent)
          .values({
            workspaceId,
            pageId: pageRow.id,
            name,
            type: "static",
            groupId: group.id,
            order: 5,
            groupOrder,
          })
          .returning()
          .get();
      await insert("API", 0);
      const second = await insert("Web", 1);

      const before = await loadApprovalBefore({
        ctx,
        input: {
          toolName: "update_page_component",
          ids: { componentId: second.id },
        },
      });
      expect(before?.values).toMatchObject({ order: 1, groupId: group.id });
    });
  });
});
