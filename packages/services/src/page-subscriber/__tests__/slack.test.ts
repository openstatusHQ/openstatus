import { db, eq, inArray } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import { expectAuditRow } from "../../../test/helpers";
import {
  createSlackSubscriber,
  listSlackSubscribersForChannel,
  removeSlackSubscriber,
} from "../index";

// page 1 = slug "status", workspace 1 (team plan, status-subscribers=true).
const PAGE_ID = 1;
const TEAM_ID = "T_SLACK_TEST";
const CHANNELS = {
  create: "C_SLACK_CREATE",
  dedup: "C_SLACK_DEDUP",
  reactivate: "C_SLACK_REACTIVATE",
  remove: "C_SLACK_REMOVE",
  list: "C_SLACK_LIST",
};

// Scope cleanup to this suite's own slack channels. A workspace-wide
// clearAuditLog would race sibling suites that share workspace 1 under
// `deno test --parallel`; our assertions filter by unique entityId, so
// stale audit rows can't match anyway.
async function cleanAll() {
  await db
    .delete(pageSubscriber)
    .where(inArray(pageSubscriber.slackChannelId, Object.values(CHANNELS)));
}

beforeAll(cleanAll);
afterAll(cleanAll);

describe("createSlackSubscriber", () => {
  test("creates an auto-accepted self-signup slack row + audit", async () => {
    const result = await createSlackSubscriber({
      input: {
        pageId: PAGE_ID,
        teamId: TEAM_ID,
        channelId: CHANNELS.create,
        channelName: "incidents",
      },
    });

    expect(result.alreadySubscribed).toBe(false);
    expect(result.pageName).toBeDefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, result.id),
    });
    expect(row?.channelType).toBe("slack");
    expect(row?.slackChannelId).toBe(CHANNELS.create);
    expect(row?.source).toBe("self_signup");
    expect(row?.acceptedAt).not.toBeNull();
    expect(row?.name).toBe("#incidents");

    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.create",
      entityType: "page_subscriber",
      entityId: result.id,
      actorType: "subscriber",
    });
  });

  test("second call is idempotent (alreadySubscribed, no duplicate)", async () => {
    const first = await createSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.dedup },
    });
    const second = await createSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.dedup },
    });

    expect(first.alreadySubscribed).toBe(false);
    expect(second.alreadySubscribed).toBe(true);

    const rows = await db.query.pageSubscriber.findMany({
      where: eq(pageSubscriber.slackChannelId, CHANNELS.dedup),
    });
    expect(rows).toHaveLength(1);
  });

  test("re-activates a previously removed channel", async () => {
    await createSlackSubscriber({
      input: {
        pageId: PAGE_ID,
        teamId: TEAM_ID,
        channelId: CHANNELS.reactivate,
      },
    });
    await removeSlackSubscriber({
      input: {
        pageId: PAGE_ID,
        teamId: TEAM_ID,
        channelId: CHANNELS.reactivate,
      },
    });
    const reactivated = await createSlackSubscriber({
      input: {
        pageId: PAGE_ID,
        teamId: TEAM_ID,
        channelId: CHANNELS.reactivate,
      },
    });

    expect(reactivated.alreadySubscribed).toBe(false);
    const rows = await db.query.pageSubscriber.findMany({
      where: eq(pageSubscriber.slackChannelId, CHANNELS.reactivate),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unsubscribedAt).toBeNull();
  });
});

describe("removeSlackSubscriber", () => {
  test("soft-deletes the active row and audits the update", async () => {
    const created = await createSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.remove },
    });
    const result = await removeSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.remove },
    });

    expect(result.removed).toBe(true);
    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, created.id),
    });
    expect(row?.unsubscribedAt).not.toBeNull();

    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: created.id,
      actorType: "subscriber",
    });
  });

  test("returns removed=false when nothing is subscribed", async () => {
    const result = await removeSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: "C_SLACK_NEVER" },
    });
    expect(result.removed).toBe(false);
  });
});

describe("listSlackSubscribersForChannel", () => {
  test("lists active subscriptions for the channel", async () => {
    await createSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.list },
    });
    const subs = await listSlackSubscribersForChannel({
      input: { teamId: TEAM_ID, channelId: CHANNELS.list },
    });
    expect(subs).toHaveLength(1);
    expect(subs[0]?.pageId).toBe(PAGE_ID);

    await removeSlackSubscriber({
      input: { pageId: PAGE_ID, teamId: TEAM_ID, channelId: CHANNELS.list },
    });
    const after = await listSlackSubscribersForChannel({
      input: { teamId: TEAM_ID, channelId: CHANNELS.list },
    });
    expect(after).toHaveLength(0);
  });
});
