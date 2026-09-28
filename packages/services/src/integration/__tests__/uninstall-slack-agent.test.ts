import { and, eq } from "@openstatus/db";
import {
  integration,
  pageSubscriber,
  slackUser,
} from "@openstatus/db/src/schema";
import { createPage, createSlackUser } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeSlackCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import { createSlackSubscriber } from "../../page-subscriber/slack";
import { installSlackAgent } from "../install-slack-agent";
import { uninstallSlackTeam } from "../uninstall-slack-agent";

const input = (teamId: string) => ({
  externalId: teamId,
  credential: { botToken: "xoxb-secret", botUserId: "B_BOT" },
  data: {
    teamId,
    teamName: "Fixture Team",
    appId: "A_APP",
    scopes: "chat:write",
    installedBy: "U_INSTALLER",
  },
});

describe("installSlackAgent plan check", () => {
  test("a plan without the Slack agent is refused", async () => {
    const free = await createWorkspaceFixture("free");
    const ctx = makeSlackCtx(free.workspace, {
      teamId: "T_FREE",
      slackUserId: "U1",
      userId: free.userId,
    });
    await expect(
      installSlackAgent({ ctx, input: input("T_FREE") }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("uninstallSlackTeam", () => {
  test("removes the integration, links and subscriptions, all audited", async () => {
    const teamId = `T_UNINSTALL_${crypto.randomUUID()}`;
    const team = await createWorkspaceFixture("team");
    const page = await createPage(team.workspace.id);

    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeSlackCtx(team.workspace, {
          teamId,
          slackUserId: "U1",
          userId: team.userId,
        }),
        db: tx,
      };
      const installed = await installSlackAgent({ ctx, input: input(teamId) });
      const link = await createSlackUser(
        team.workspace.id,
        team.userId,
        { slackTeamId: teamId },
        tx,
      );
      const sub = await createSlackSubscriber({
        input: { pageId: page.id, teamId, channelId: "C_UNINSTALL" },
        db: tx,
      });

      const result = await uninstallSlackTeam({
        input: { teamId },
        job: "slack-app_uninstalled",
        db: tx,
      });
      expect(result).toEqual({ workspaces: 1, unsubscribed: 1 });

      expect(
        await tx
          .select()
          .from(integration)
          .where(eq(integration.id, installed.id))
          .get(),
      ).toBeUndefined();
      expect(
        await tx
          .select()
          .from(slackUser)
          .where(and(eq(slackUser.id, link.id)))
          .get(),
      ).toBeUndefined();
      const subscriber = await tx
        .select()
        .from(pageSubscriber)
        .where(eq(pageSubscriber.id, sub.id))
        .get();
      expect(subscriber).toBeDefined();
      expect(subscriber?.unsubscribedAt).not.toBeNull();

      await expectAuditRow({
        workspaceId: team.workspace.id,
        action: "integration.delete",
        entityType: "integration",
        entityId: installed.id,
        actorType: "system",
        db: tx,
      });
      await expectAuditRow({
        workspaceId: team.workspace.id,
        action: "slack_user.delete",
        entityType: "slack_user",
        entityId: link.id,
        actorType: "system",
        db: tx,
      });
      await expectAuditRow({
        workspaceId: team.workspace.id,
        action: "page_subscriber.update",
        entityType: "page_subscriber",
        entityId: sub.id,
        actorType: "system",
        db: tx,
      });
    });
  });
});
