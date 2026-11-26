import { monitor, page } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx } from "../../context";
import { ValidationError } from "../../errors";
import type { Workspace } from "../../types";
import {
  addPageComponentTool,
  listPageComponentsTool,
  updatePageComponentTool,
} from "../index";

let workspace: Workspace;
let userId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  userId = fixture.userId;
});

async function seed(tx: DrizzleTx, jobType: "http" | "heartbeat" = "http") {
  const p = await tx
    .insert(page)
    .values({
      workspaceId: workspace.id,
      title: "Visibility tools",
      description: "",
      slug: `visibility-tools-${crypto.randomUUID().slice(0, 8)}`,
      customDomain: "",
    })
    .returning()
    .get();
  const m = await tx
    .insert(monitor)
    .values({
      workspaceId: workspace.id,
      jobType,
      name: "API",
      url: jobType === "http" ? "https://example.com" : "",
      periodicity: "10m",
      regions: "",
      active: true,
    })
    .returning()
    .get();
  return { pageId: p.id, monitorId: m.id };
}

describe("page component visibility through the agent tools", () => {
  test("add, list and update carry `public`", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const { pageId, monitorId } = await seed(tx);

      const added = await addPageComponentTool.run({
        ctx,
        input: addPageComponentTool.inputSchema.parse({
          pageId,
          monitorId,
          public: true,
        }),
      });
      expect(added.public).toBe(true);

      const listed = await listPageComponentsTool.run({
        ctx,
        input: { pageId },
      });
      expect(listed.items.find((c) => c.id === added.id)?.public).toBe(true);

      const updated = await updatePageComponentTool.run({
        ctx,
        input: updatePageComponentTool.inputSchema.parse({
          componentId: added.id,
          public: false,
        }),
      });
      expect(updated.public).toBe(false);
      expect(updatePageComponentTool.outputSchema.parse(updated)).toBeDefined();
    });
  });

  test("components added without `public` start private", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const { pageId, monitorId } = await seed(tx);
      const added = await addPageComponentTool.run({
        ctx,
        input: addPageComponentTool.inputSchema.parse({ pageId, monitorId }),
      });
      expect(added.public).toBe(false);
    });
  });

  test("a heartbeat cannot be made public", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const { pageId, monitorId } = await seed(tx, "heartbeat");
      await expect(
        addPageComponentTool.run({
          ctx,
          input: addPageComponentTool.inputSchema.parse({
            pageId,
            monitorId,
            public: true,
          }),
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("approval summaries show the visibility change", () => {
    const add = addPageComponentTool.approval?.summarize({
      pageId: 3,
      monitorId: 12,
      public: true,
    });
    expect(add?.lines.at(-1)).toEqual({ label: "Public", value: "Yes" });

    const update = updatePageComponentTool.approval?.summarize({
      componentId: 9,
      public: false,
    });
    expect(update?.lines.at(-1)).toEqual({ label: "Public", value: "No" });
  });
});
