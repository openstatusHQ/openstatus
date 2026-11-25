import { eq } from "@openstatus/db";
import { apiKey, monitor, pageSubscriber } from "@openstatus/db/src/schema";
import { createMonitor, createPage } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeSlackCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
  type WorkspaceFixture,
} from "../../../test/helpers";
import { createApiKey, revokeApiKey } from "../../api-key";
import type { DB, ServiceContext } from "../../context";
import { installSlackAgent } from "../../integration";
import { createInvitation, deleteInvitation } from "../../invitation";
import { regenerateHeartbeatToken } from "../../monitor";
import {
  createNotification,
  deleteNotification,
  updateNotification,
} from "../../notification";
import { deletePage, updatePagePasswordProtection } from "../../page";
import {
  createPageSubscriber,
  deletePageSubscriber,
} from "../../page-subscriber";

// Credentials must never reach an audit snapshot: audit rows are readable by
// every workspace member and outlive the entity. Private-location tokens are
// the documented exception (see `private-location/create.ts`).

let team: WorkspaceFixture;
let ctx: ServiceContext;

beforeAll(async () => {
  team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
});

async function auditText(tx: DB): Promise<string> {
  const rows = await readAuditLog({ workspaceId: team.workspace.id, db: tx });
  return JSON.stringify(rows.map((r) => [r.before, r.after, r.metadata]));
}

async function expectNotAudited(tx: DB, secrets: string[]) {
  const text = await auditText(tx);
  for (const secret of secrets) expect(text).not.toContain(secret);
}

describe("audit snapshots carry no secrets", () => {
  test("page password", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const page = await createPage(team.workspace.id, {}, tx);
      const password = `pw-${crypto.randomUUID()}`;

      await updatePagePasswordProtection({
        ctx: txCtx,
        input: { id: page.id, accessType: "password", password },
      });
      const [update] = await readAuditLog({
        workspaceId: team.workspace.id,
        entityType: "page",
        entityId: page.id,
        db: tx,
      });
      // A set or rotated password still diffs; only its value is hidden.
      expect(update?.changedFields).toContain("password");
      expect(update?.after?.password).toBe("[redacted]");
      await deletePage({ ctx: txCtx, input: { id: page.id } });

      await expectNotAudited(tx, [password]);
    });
  });

  test("API key token and hash", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const { token, key } = await createApiKey({
        ctx: txCtx,
        input: { name: "audit-secret" },
      });
      const stored = await tx
        .select({ hashedToken: apiKey.hashedToken })
        .from(apiKey)
        .where(eq(apiKey.id, key.id))
        .get();
      await revokeApiKey({ ctx: txCtx, input: { id: key.id } });

      await expectNotAudited(tx, [token, stored?.hashedToken ?? token]);
    });
  });

  test("heartbeat token", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor(
        team.workspace.id,
        { jobType: "heartbeat", heartbeatToken: `hb-${crypto.randomUUID()}` },
        tx,
      );
      await regenerateHeartbeatToken({
        ctx: { ...ctx, db: tx },
        input: { id: row.id },
      });
      const after = await tx
        .select({ heartbeatToken: monitor.heartbeatToken })
        .from(monitor)
        .where(eq(monitor.id, row.id))
        .get();

      await expectNotAudited(tx, [
        row.heartbeatToken ?? "",
        after?.heartbeatToken ?? "",
      ]);
    });
  });

  test("notification webhook secret", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const secret = `wh${crypto.randomUUID().replaceAll("-", "")}`;
      const rotated = `wh${crypto.randomUUID().replaceAll("-", "")}`;
      const created = await createNotification({
        ctx: txCtx,
        input: {
          name: "audit-secret",
          provider: "discord",
          data: { discord: `https://discord.com/api/webhooks/1/${secret}` },
          monitors: [],
        },
      });
      await updateNotification({
        ctx: txCtx,
        input: {
          id: created.id,
          name: "audit-secret",
          data: { discord: `https://discord.com/api/webhooks/1/${rotated}` },
          monitors: [],
        },
      });
      await deleteNotification({ ctx: txCtx, input: { id: created.id } });

      await expectNotAudited(tx, [secret, rotated]);
    });
  });

  test("Slack bot token", async () => {
    await withTestTransaction(async (tx) => {
      const botToken = `xoxb-${crypto.randomUUID()}`;
      const teamId = `T${crypto.randomUUID().slice(0, 8)}`;
      await installSlackAgent({
        ctx: {
          ...makeSlackCtx(team.workspace, {
            teamId,
            slackUserId: "U_AUDIT",
            userId: team.userId,
          }),
          db: tx,
        },
        input: {
          externalId: teamId,
          credential: { botToken, botUserId: "B_AUDIT" },
          data: {
            teamId,
            teamName: "Audit",
            appId: "A_AUDIT",
            scopes: "chat:write",
            installedBy: "U_AUDIT",
          },
        },
      });

      await expectNotAudited(tx, [botToken]);
    });
  });

  test("invitation token", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const invite = await createInvitation({
        ctx: txCtx,
        input: { email: `audit-${crypto.randomUUID()}@openstatus.dev` },
      });
      await deleteInvitation({ ctx: txCtx, input: { id: invite.id } });

      await expectNotAudited(tx, [invite.token]);
    });
  });

  test("page subscriber management token", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const page = await createPage(team.workspace.id, {}, tx);
      const sub = await createPageSubscriber({
        ctx: txCtx,
        input: {
          pageId: page.id,
          channelType: "email",
          email: `sub-${crypto.randomUUID()}@openstatus.dev`,
        },
      });
      const stored = await tx
        .select({ token: pageSubscriber.token })
        .from(pageSubscriber)
        .where(eq(pageSubscriber.id, sub.id))
        .get();
      await deletePageSubscriber({
        ctx: txCtx,
        input: { id: sub.id, pageId: page.id },
      });

      expect(stored?.token).toBeTruthy();
      await expectNotAudited(tx, [stored?.token ?? ""]);
    });
  });

  test("page subscriber webhook secret", async () => {
    await withTestTransaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const page = await createPage(team.workspace.id, {}, tx);
      const secret = `wh${crypto.randomUUID().replaceAll("-", "")}`;
      const sub = await createPageSubscriber({
        ctx: txCtx,
        input: {
          pageId: page.id,
          channelType: "webhook",
          webhookUrl: `https://hooks.slack.com/services/T0/B0/${secret}`,
        },
      });
      await deletePageSubscriber({
        ctx: txCtx,
        input: { id: sub.id, pageId: page.id },
      });

      await expectNotAudited(tx, [secret]);
    });
  });
});
