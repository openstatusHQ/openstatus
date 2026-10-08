import { selectWorkspaceSchema } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createSlackUser,
  createUser,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { signSlackLinkToken } from "@openstatus/services/slack-user";
import { expect } from "@std/expect";
import { beforeAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { lambdaRouter } from "../lambda";
import { createInnerTRPCContext } from "../trpc";

const SECRET = "test-slack-signing-secret";

let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
let ownerId: number;
let otherId: number;

// Passing both `user` and `workspace` trips the NODE_ENV=test escape hatch in
// the authed middleware, so the caller is scoped to this suite's workspace.
function callerFor(userId: number) {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: String(userId) } },
    // @ts-expect-error - minimal user for test
    user: { id: userId },
    workspace,
  });
  return lambdaRouter.createCaller(ctx);
}

beforeAll(async () => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
  workspace = selectWorkspaceSchema.parse(await createWorkspace());
  ownerId = (await createUser()).id;
  otherId = (await createUser()).id;
  await addUserToWorkspace(ownerId, workspace.id, "member");
  await addUserToWorkspace(otherId, workspace.id, "member");
});

test("link refuses to move a Slack account linked to another member", async () => {
  const linked = await createSlackUser(workspace.id, ownerId);
  const token = await signSlackLinkToken(SECRET, {
    workspaceId: workspace.id,
    teamId: linked.slackTeamId,
    slackUserId: linked.slackUserId,
  });

  const err = await callerFor(otherId)
    .slackUser.link({ token })
    .catch((e: unknown) => e);
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe("CONFLICT");

  // The owner of the link can still redeem it.
  const row = await callerFor(ownerId).slackUser.link({ token });
  expect(row?.userId).toBe(ownerId);
});

test("link maps an unlinked Slack account to the caller", async () => {
  const token = await signSlackLinkToken(SECRET, {
    workspaceId: workspace.id,
    teamId: "T_ROUTER",
    slackUserId: `U_${crypto.randomUUID()}`,
  });
  const row = await callerFor(otherId).slackUser.link({ token });
  expect(row?.userId).toBe(otherId);
});
