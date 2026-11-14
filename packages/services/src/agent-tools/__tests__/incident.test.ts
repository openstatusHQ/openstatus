import { eq } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeMcpCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { Workspace } from "../../types";
import {
  acknowledgeIncidentTool,
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

  test("acknowledge_incident runs without approval and shows in reads", async () => {
    expect(acknowledgeIncidentTool.destructive).toBe(false);
    expect(acknowledgeIncidentTool.approval).toBeUndefined();
    expect(acknowledgeIncidentTool.scope).toBe("incidents:write");

    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeMcpCtx(workspace, { keyId: "key_mcp", userId }),
        db: tx,
      };
      const declared = await declareIncidentTool.run({
        ctx,
        input: declareIncidentTool.inputSchema.parse({
          title: "Queue backlog",
          severity: "minor",
        }),
      });
      const before = await listIncidentsTool.run({
        ctx,
        input: listIncidentsTool.inputSchema.parse({}),
      });
      expect(
        before.items.find((i) => i.id === declared.id)?.acknowledgedAt,
      ).toBeNull();

      const acked = await acknowledgeIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(acked.id).toBe(declared.id);
      expect(acked.acknowledgedAt).toEqual(expect.any(String));

      const detail = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(detail.acknowledgedAt).toBe(acked.acknowledgedAt);
      expect(detail.acknowledgedBy?.id).toBe(userId);
      expect(detail.events[0]?.type).toBe("acknowledged");
      expect(getIncidentTool.outputSchema.parse(detail)).toBeDefined();

      const after = await listIncidentsTool.run({
        ctx,
        input: listIncidentsTool.inputSchema.parse({}),
      });
      const row = after.items.find((i) => i.id === declared.id);
      expect(row?.acknowledgedBy?.id).toBe(userId);
      expect(listIncidentsTool.outputSchema.parse(after)).toBeDefined();

      await expect(
        acknowledgeIncidentTool.run({ ctx, input: { id: declared.id } }),
      ).rejects.toThrow(/already acknowledged/);
    });
  });

  test("acknowledge_incident rejects a read-only key", async () => {
    await expect(
      acknowledgeIncidentTool.run({
        ctx: makeApiKeyCtx(workspace, {
          keyId: "key_ro",
          scopes: ["incidents:read"],
        }),
        input: { id: 1 },
      }),
    ).rejects.toThrow(/lacks required scope/);
  });
  test("reported at is set at declare, changed on update and read back", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const reportedAt = new Date(
        Math.floor(Date.now() / 1000) * 1000 - 30 * 60_000,
      ).toISOString();
      const declared = await declareIncidentTool.run({
        ctx,
        input: declareIncidentTool.inputSchema.parse({
          title: "Mail outage",
          severity: "major",
          reportedAt,
        }),
      });
      const detail = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(detail.reportedAt).toBe(reportedAt);

      await updateIncidentTool.run({
        ctx,
        input: updateIncidentTool.inputSchema.parse({
          id: declared.id,
          reportedAt: null,
        }),
      });
      const list = await listIncidentsTool.run({
        ctx,
        input: listIncidentsTool.inputSchema.parse({}),
      });
      const listed = list.items.find((i) => i.id === declared.id);
      expect(listed?.reportedAt).toBeNull();
      expect(listIncidentsTool.outputSchema.parse(list)).toBeDefined();
      const after = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(after.events.map((e) => e.type)).toContain("reported_at_changed");
    });
  });

  test("list and get carry the SLA state of tracked incidents only", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const declared = await declareIncidentTool.run({
        ctx,
        input: declareIncidentTool.inputSchema.parse({
          title: "Login slow",
          severity: "critical",
        }),
      });
      const untracked = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(untracked.sla).toBeNull();

      const minute = 60_000;
      const declaredAt = new Date(
        Math.floor(Date.now() / 1000) * 1000 - 90 * minute,
      );
      const at = (minutes: number) =>
        new Date(declaredAt.getTime() + minutes * minute).toISOString();
      await tx
        .update(incident)
        .set({
          declaredAt,
          slaSnapshot: {
            targets: {
              critical: { responseMinutes: 60, resolutionMinutes: 100 },
            },
            resolutionStop: "mitigated",
          },
          responseMetAt: new Date(at(70)),
          responseBreachDueAt: new Date(at(60)),
          responseMissReason: "Pager rotation gap",
        })
        .where(eq(incident.id, declared.id));

      const expected = {
        response: {
          targetMinutes: 60,
          dueAt: at(60),
          metAt: at(70),
          missedAt: at(60),
          missReason: "Pager rotation gap",
          status: "breached",
        },
        resolution: {
          targetMinutes: 100,
          dueAt: at(100),
          metAt: null,
          missedAt: null,
          missReason: null,
          status: "at_risk",
        },
      };
      const detail = await getIncidentTool.run({
        ctx,
        input: { id: declared.id },
      });
      expect(detail.sla).toEqual(expected);
      expect(getIncidentTool.outputSchema.parse(detail)).toBeDefined();

      const list = await listIncidentsTool.run({
        ctx,
        input: listIncidentsTool.inputSchema.parse({}),
      });
      expect(list.items.find((i) => i.id === declared.id)?.sla).toEqual(
        expected,
      );
      expect(listIncidentsTool.outputSchema.parse(list)).toBeDefined();
    });
  });
});
