import { selectWorkspaceSchema } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { WebClient } from "@slack/web-api";
import { expect } from "@std/expect";
import { beforeAll, beforeEach, describe, test } from "@std/testing/bdd";

// @slack/web-api is the import-mapped double; `users.info` is driven by
// slackTestState.usersInfoImpl.
import { slackTestState } from "@/libs/test/doubles/slack-test-state";

import { resetSlackUserCache, resolveSlackUserId } from "./resolve-slack-user";

let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
let memberId: number;
let memberEmail: string;
const slack = new WebClient("xoxb-test");

const withEmail = (email?: string) => () =>
  Promise.resolve({ ok: true, user: { profile: email ? { email } : {} } });

const infoCalls = () =>
  slackTestState.calls.filter((c) => c.method === "users.info").length;

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
  resetSlackUserCache();
});

describe("resolveSlackUserId", () => {
  test("matches the member by email and caches the hit", async () => {
    slackTestState.usersInfoImpl = withEmail(memberEmail.toUpperCase());
    const args = { workspace, teamId: "T1", slackUserId: "U_A", slack };
    expect(await resolveSlackUserId(args)).toBe(memberId);
    expect(await resolveSlackUserId(args)).toBe(memberId);
    expect(infoCalls()).toBe(1);
  });

  test("a miss is not retried until the cache is cleared", async () => {
    const args = { workspace, teamId: "T1", slackUserId: "U_B", slack };
    expect(await resolveSlackUserId(args)).toBeNull();
    expect(infoCalls()).toBe(1);

    slackTestState.usersInfoImpl = withEmail(memberEmail);
    expect(await resolveSlackUserId(args)).toBeNull();
    expect(infoCalls()).toBe(1);

    resetSlackUserCache();
    expect(await resolveSlackUserId(args)).toBe(memberId);
    expect(infoCalls()).toBe(2);
  });

  test("returns null when the email matches no member of this workspace", async () => {
    const outsider = await createUser();
    slackTestState.usersInfoImpl = withEmail(outsider.email as string);
    expect(
      await resolveSlackUserId({
        workspace,
        teamId: "T1",
        slackUserId: "U_C",
        slack,
      }),
    ).toBeNull();
  });

  test("swallows Slack errors such as missing_scope", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.reject(
        Object.assign(new Error("An API error occurred: missing_scope"), {
          data: { ok: false, error: "missing_scope" },
        }),
      );
    expect(
      await resolveSlackUserId({
        workspace,
        teamId: "T1",
        slackUserId: "U_D",
        slack,
      }),
    ).toBeNull();
  });

  test("skips resolution entirely without a team or user id", async () => {
    expect(
      await resolveSlackUserId({
        workspace,
        teamId: "",
        slackUserId: "U_E",
        slack,
      }),
    ).toBeNull();
    expect(infoCalls()).toBe(0);
  });
});
