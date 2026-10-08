import { and, db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createSlackUser,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { WebClient } from "@slack/web-api";
import { expect } from "@std/expect";
import { beforeAll, beforeEach, describe, test } from "@std/testing/bdd";

// @slack/web-api is the import-mapped double; `users.info` is driven by
// slackTestState.usersInfoImpl.
import { slackTestState } from "@/libs/test/doubles/slack-test-state";

import { resolveSlackMember } from "./resolve-slack-user";

let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
let memberId: number;
let memberEmail: string;
const slack = new WebClient("xoxb-test");

const withEmail = (email?: string) => () =>
  Promise.resolve({ ok: true, user: { profile: email ? { email } : {} } });

const infoCalls = () =>
  slackTestState.calls.filter((c) => c.method === "users.info").length;

const slackId = () => `U_${crypto.randomUUID()}`;

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspace = selectWorkspaceSchema.parse(fixture.workspace);
  const member = await createUser();
  memberId = member.id;
  memberEmail = member.email as string;
  await addUserToWorkspace(memberId, workspace.id, "member");
});

beforeEach(() => {
  slackTestState.calls = [];
  slackTestState.usersInfoImpl = withEmail(undefined);
});

describe("resolveSlackMember", () => {
  test("links the member by email once, then reads the stored link", async () => {
    slackTestState.usersInfoImpl = withEmail(memberEmail.toUpperCase());
    const args = { workspace, teamId: "T1", slackUserId: slackId(), slack };
    expect(await resolveSlackMember(args)).toBe(memberId);
    expect(await resolveSlackMember(args)).toBe(memberId);
    expect(infoCalls()).toBe(1);
  });

  test("an existing link wins without calling Slack", async () => {
    const slackUserId = slackId();
    await createSlackUser(workspace.id, memberId, {
      slackTeamId: "T1",
      slackUserId,
    });
    expect(
      await resolveSlackMember({ workspace, teamId: "T1", slackUserId, slack }),
    ).toBe(memberId);
    expect(infoCalls()).toBe(0);
  });

  test("a miss is retried on the next interaction", async () => {
    const args = { workspace, teamId: "T1", slackUserId: slackId(), slack };
    expect(await resolveSlackMember(args)).toBeNull();
    slackTestState.usersInfoImpl = withEmail(memberEmail);
    expect(await resolveSlackMember(args)).toBe(memberId);
    expect(infoCalls()).toBe(2);
  });

  test("returns null when the email matches no member of this workspace", async () => {
    const outsider = await createUser();
    slackTestState.usersInfoImpl = withEmail(outsider.email as string);
    expect(
      await resolveSlackMember({
        workspace,
        teamId: "T1",
        slackUserId: slackId(),
        slack,
      }),
    ).toBeNull();
  });

  test("a removed member's link no longer resolves", async () => {
    const leaver = await createUser();
    await addUserToWorkspace(leaver.id, workspace.id, "member");
    const slackUserId = slackId();
    await createSlackUser(workspace.id, leaver.id, {
      slackTeamId: "T1",
      slackUserId,
    });
    expect(
      await resolveSlackMember({ workspace, teamId: "T1", slackUserId, slack }),
    ).toBe(leaver.id);

    await db
      .delete(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.userId, leaver.id),
          eq(usersToWorkspaces.workspaceId, workspace.id),
        ),
      );
    expect(
      await resolveSlackMember({ workspace, teamId: "T1", slackUserId, slack }),
    ).toBeNull();
  });

  test("swallows Slack errors such as missing_scope", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.reject(new Error("An API error occurred: missing_scope"));
    expect(
      await resolveSlackMember({
        workspace,
        teamId: "T1",
        slackUserId: slackId(),
        slack,
      }),
    ).toBeNull();
  });

  test("skips resolution entirely without a team or user id", async () => {
    expect(
      await resolveSlackMember({
        workspace,
        teamId: "",
        slackUserId: "U_E",
        slack,
      }),
    ).toBeNull();
    expect(
      await resolveSlackMember({
        workspace,
        teamId: "T1",
        slackUserId: "",
        slack,
      }),
    ).toBeNull();
    expect(infoCalls()).toBe(0);
  });
});
