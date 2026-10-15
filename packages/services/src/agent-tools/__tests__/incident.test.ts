import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { Workspace } from "../../types";
import {
  addIncidentNoteTool,
  declareIncidentTool,
  getIncidentTool,
  listIncidentsTool,
  resolveIncidentTool,
  updateIncidentTool,
} from "../index";

let workspace: Workspace;
let userId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  userId = fixture.userId;
});

describe("incident agent tools", () => {
  test("declare defaults the commander to the requester, then the full loop", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const declared = await declareIncidentTool.run({
        ctx,
        input: declareIncidentTool.inputSchema.parse({
          title: "Checkout failing",
          severity: "critical",
        }),
      });
      await updateIncidentTool.run({
        ctx,
        input: { id: declared.id, severity: "major" },
      });
      await addIncidentNoteTool.run({
        ctx,
        input: { id: declared.id, message: "Rolled back" },
      });
      const resolved = await resolveIncidentTool.run({
        ctx,
        input: { id: declared.id, note: "Fixed" },
      });
      expect(resolved.status).toBe("resolved");

      const list = await listIncidentsTool.run({
        ctx,
        input: listIncidentsTool.inputSchema.parse({}),
      });
      expect(list.items.map((i) => i.id)).toContain(declared.id);

      const detail = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(detail.commander?.id).toBe(userId);
      expect(detail.severity).toBe("major");
      expect(detail.events.map((e) => e.type)).toEqual([
        "resolved",
        "note",
        "severity_changed",
        "declared",
      ]);
      expect(getIncidentTool.outputSchema.parse(detail)).toBeDefined();
    });
  });
});
