import { sql } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import { resolveSlackTeamWorkspace } from "../resolve-slack-team";

const newTeamId = () => `T_RESOLVE_${crypto.randomUUID()}`;

describe("resolveSlackTeamWorkspace", () => {
  test("returns null for a team without an install", async () => {
    await withTestTransaction(async (tx) => {
      expect(
        await resolveSlackTeamWorkspace(newTeamId(), { db: tx }),
      ).toBeNull();
    });
  });

  test("resolves the workspace, bot token and granted scopes", async () => {
    const team = await createWorkspaceFixture("team");
    const teamId = newTeamId();
    await withTestTransaction(async (tx) => {
      await tx.insert(integration).values({
        name: "slack-agent",
        workspaceId: team.workspace.id,
        externalId: teamId,
        credential: { botToken: "xoxb-a", botUserId: "B_A" },
        data: { scopes: "chat:write" },
      });

      const resolved = await resolveSlackTeamWorkspace(teamId, { db: tx });
      expect(resolved?.workspace.id).toBe(team.workspace.id);
      expect(resolved?.botToken).toBe("xoxb-a");
      expect(resolved?.botUserId).toBe("B_A");
      expect(resolved?.scopes).toBe("chat:write");
    });
  });

  test("the most recently updated install wins across workspaces", async () => {
    const older = await createWorkspaceFixture("team");
    const newer = await createWorkspaceFixture("team");
    const teamId = newTeamId();
    await withTestTransaction(async (tx) => {
      await tx.insert(integration).values([
        {
          name: "slack-agent",
          workspaceId: older.workspace.id,
          externalId: teamId,
          credential: { botToken: "xoxb-old", botUserId: "B" },
          data: {},
          updatedAt: new Date(Date.now() - 60_000),
        },
        {
          name: "slack-agent",
          workspaceId: newer.workspace.id,
          externalId: teamId,
          credential: { botToken: "xoxb-new", botUserId: "B" },
          data: {},
          updatedAt: new Date(),
        },
      ]);

      const resolved = await resolveSlackTeamWorkspace(teamId, { db: tx });
      expect(resolved?.workspace.id).toBe(newer.workspace.id);
      expect(resolved?.botToken).toBe("xoxb-new");
    });
  });

  test("an install without a bot token resolves to null", async () => {
    const team = await createWorkspaceFixture("team");
    const teamId = newTeamId();
    await withTestTransaction(async (tx) => {
      await tx.insert(integration).values({
        name: "slack-agent",
        workspaceId: team.workspace.id,
        externalId: teamId,
        credential: { botUserId: "B" },
        data: {},
      });
      expect(await resolveSlackTeamWorkspace(teamId, { db: tx })).toBeNull();
    });
  });

  test("malformed data degrades to empty scopes", async () => {
    const team = await createWorkspaceFixture("team");
    const teamId = newTeamId();
    await withTestTransaction(async (tx) => {
      await tx.insert(integration).values({
        name: "slack-agent",
        workspaceId: team.workspace.id,
        externalId: teamId,
        credential: { botToken: "xoxb-a" },
        data: sql`'{not json'`,
      });

      const resolved = await resolveSlackTeamWorkspace(teamId, { db: tx });
      expect(resolved?.scopes).toBe("");
      expect(resolved?.botUserId).toBe("");
    });
  });
});
