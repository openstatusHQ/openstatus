import { page } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { type AnyAgentTool, agentTools, loadApprovalBefore } from "../index";

const TEST_PREFIX = "agent-tools-approval-before-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("approval loadBefore", () => {
  test("every update tool loads its entity by an integer id field", () => {
    for (const tool of Object.values(agentTools) as AnyAgentTool[]) {
      const loadBefore = tool.approval?.loadBefore;
      expect(Boolean(loadBefore), tool.name).toBe(
        tool.name.startsWith("update_"),
      );
      if (!loadBefore) continue;
      expect(
        tool.inputSchema.shape[loadBefore.idField],
        `${tool.name}.${loadBefore.idField}`,
      ).toBeDefined();
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
});
