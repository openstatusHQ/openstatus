import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, desc, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  clearAuditLog,
  loadSeededWorkspace,
  makeSlackCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { installSlackAgent } from "../install-slack-agent";

const TEAM_ID = "T_FIXTURE";
const SLACK_USER_ID = "U_FIXTURE";

let ctx: ServiceContext;

async function clearSlackAgentRows() {
  await db
    .delete(integration)
    .where(
      and(
        eq(integration.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
        eq(integration.name, "slack-agent"),
      ),
    )
    .catch(() => undefined);
}

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  ctx = makeSlackCtx(team, { teamId: TEAM_ID, slackUserId: SLACK_USER_ID });
  // Wipe leftover slack-agent rows from prior aborted runs — a stale
  // committed row would block fresh installs (one slack-agent per workspace).
  await clearSlackAgentRows();
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
});

afterAll(async () => {
  await clearSlackAgentRows();
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
});

const baseInput = {
  externalId: TEAM_ID,
  credential: { botToken: "xoxb-secret", botUserId: "B_BOT" },
  data: {
    teamId: TEAM_ID,
    teamName: "Fixture Team",
    appId: "A_APP",
    scopes: "chat:write,channels:history",
    installedBy: SLACK_USER_ID,
  },
};

describe("installSlackAgent", () => {
  test("first install inserts row and emits integration.create", async () => {
    await withTestTransaction(async (tx) => {
      const created = await installSlackAgent({
        ctx: { ...ctx, db: tx },
        input: baseInput,
      });

      expect(created.name).toBe("slack-agent");
      expect(created.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
      expect(created.externalId).toBe(TEAM_ID);

      const rows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        entityId: created.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row.action).toBe("integration.create");
      expect(row.actorType).toBe("slack");
      expect(row.before).toBeNull();
      // Bot token must never appear in the snapshot.
      expect(JSON.stringify(row.after)).not.toContain("xoxb-secret");
      expect((row.after as Record<string, unknown>).credential).toBeUndefined();
    });
  });

  test("reinstall updates row and emits integration.update with credential diff", async () => {
    await withTestTransaction(async (tx) => {
      const ctxTx = { ...ctx, db: tx };
      const created = await installSlackAgent({ ctx: ctxTx, input: baseInput });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      const reinstalled = await installSlackAgent({
        ctx: ctxTx,
        input: {
          ...baseInput,
          credential: { botToken: "xoxb-rotated", botUserId: "B_BOT" },
          data: { ...baseInput.data, scopes: "chat:write" },
        },
      });

      expect(reinstalled.id).toBe(created.id);

      const rows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        entityId: created.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row.action).toBe("integration.update");
      expect(row.changedFields).toContain("data");
      expect(row.changedFields).toContain("credentialFingerprint");
      expect(JSON.stringify(row.before)).not.toContain("xoxb-secret");
      expect(JSON.stringify(row.after)).not.toContain("xoxb-rotated");
    });
  });

  test("token-only rotation still emits an audit row via the fingerprint", async () => {
    await withTestTransaction(async (tx) => {
      const ctxTx = { ...ctx, db: tx };
      const created = await installSlackAgent({ ctx: ctxTx, input: baseInput });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      await installSlackAgent({
        ctx: ctxTx,
        input: {
          ...baseInput,
          credential: { botToken: "xoxb-rotated", botUserId: "B_BOT" },
        },
      });

      const rows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        entityId: created.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("integration.update");
      expect(rows[0].changedFields).toEqual(["credentialFingerprint"]);
    });
  });

  test("identical reinstall is a no-op and does not emit an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctxTx = { ...ctx, db: tx };
      const created = await installSlackAgent({ ctx: ctxTx, input: baseInput });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      await installSlackAgent({ ctx: ctxTx, input: baseInput });

      const rows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        entityId: created.id,
        db: tx,
      });
      expect(rows).toHaveLength(0);
    });
  });

  test("rejects empty bot token at the schema boundary", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        installSlackAgent({
          ctx: { ...ctx, db: tx },
          input: {
            ...baseInput,
            credential: { botToken: "", botUserId: "B" },
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("consolidates duplicate slack-agent rows in the same workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctxTx = { ...ctx, db: tx };
      // Simulate legacy data: two `slack-agent` rows for the same workspace.
      // Insert directly to bypass the service guard. The DB has no
      // `UNIQUE (workspace_id, name)` index, so the service does the
      // consolidation in code.
      const [first] = await tx
        .insert(integration)
        .values({
          name: "slack-agent",
          workspaceId: SEEDED_WORKSPACE_TEAM_ID,
          externalId: "T_OLD_1",
          credential: { botToken: "xoxb-old-1", botUserId: "B_OLD_1" },
          data: { ...baseInput.data, teamId: "T_OLD_1" },
        })
        .returning();
      const [second] = await tx
        .insert(integration)
        .values({
          name: "slack-agent",
          workspaceId: SEEDED_WORKSPACE_TEAM_ID,
          externalId: "T_OLD_2",
          credential: { botToken: "xoxb-old-2", botUserId: "B_OLD_2" },
          data: { ...baseInput.data, teamId: "T_OLD_2" },
        })
        .returning();
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      await installSlackAgent({ ctx: ctxTx, input: baseInput });

      const remaining = await tx
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.name, "slack-agent"),
            eq(integration.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          ),
        )
        .orderBy(desc(integration.id))
        .all();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(second.id);

      const all = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        db: tx,
      });
      expect(all.find((r) => r.action === "integration.delete")?.entityId).toBe(
        String(first.id),
      );
      const updateRow = all.find((r) => r.action === "integration.update");
      expect(updateRow?.entityId).toBe(String(second.id));
      // The deleted sibling's snapshot must carry the fingerprint, same
      // shape as create/update — proves delete-path symmetry.
      const deleteRow = all.find((r) => r.action === "integration.delete");
      expect(
        (deleteRow?.before as Record<string, unknown> | null)
          ?.credentialFingerprint,
      ).toBeTypeOf("string");
    });
  });

  test("propagates the openstatus userId from the slack actor", async () => {
    await withTestTransaction(async (tx) => {
      const ATTRIBUTED_USER_ID = 1;
      const attributedCtx: ServiceContext = {
        ...ctx,
        actor: {
          type: "slack",
          teamId: TEAM_ID,
          slackUserId: SLACK_USER_ID,
          userId: ATTRIBUTED_USER_ID,
        },
        db: tx,
      };

      const created = await installSlackAgent({
        ctx: attributedCtx,
        input: baseInput,
      });

      const rows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "integration",
        entityId: created.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].actorUserId).toBe(ATTRIBUTED_USER_ID);
    });
  });
});
