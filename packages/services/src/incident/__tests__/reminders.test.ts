import { integration } from "@openstatus/db/src/schema";
import {
  createIncident,
  createIncidentEvent,
  createSlackUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB } from "../../context";
import { SLACK_BOT_SCOPES } from "../../integration/slack-scopes";
import type { Workspace } from "../../types";
import {
  reminderWindow,
  remindStaleIncidents,
  type SlackIncidentClient,
} from "../index";

const HOUR = 60 * 60 * 1000;

let workspace: Workspace;
let userId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  userId = fixture.userId;
});

describe("reminderWindow", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * HOUR);

  test("fresh, then windows that double", () => {
    expect(reminderWindow("major", ago(3), now)).toBeNull();
    expect(reminderWindow("major", ago(4), now)).toBe(0);
    expect(reminderWindow("major", ago(7.9), now)).toBe(0);
    expect(reminderWindow("major", ago(8), now)).toBe(1);
    expect(reminderWindow("major", ago(16), now)).toBe(2);
    expect(reminderWindow("critical", ago(1), now)).toBe(0);
    expect(reminderWindow("minor", ago(23), now)).toBeNull();
  });
});

function fakeClient() {
  const sent: { channel: string; text: string }[] = [];
  const client = {
    chat: {
      postMessage: async (args: { channel: string; text: string }) => {
        sent.push(args);
        return { ok: true, ts: "1.1" };
      },
    },
  } as SlackIncidentClient;
  return { client, sent };
}

function memoryClaim() {
  const keys = new Set<string>();
  return {
    claim: async (key: string) => {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    release: async (key: string) => {
      keys.delete(key);
    },
  };
}

async function connect(
  tx: DB,
  teamId: string,
  scopes: readonly string[] = SLACK_BOT_SCOPES,
) {
  await tx.insert(integration).values({
    name: "slack-agent",
    workspaceId: workspace.id,
    externalId: teamId,
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId, scopes: scopes.join(",") },
  });
}

describe("remindStaleIncidents", () => {
  test("bound channel first, then the commander's DM, once per window", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = `T_REM_${crypto.randomUUID()}`;
      await connect(tx, teamId);
      const stale = new Date(Date.now() - 5 * HOUR);
      const inChannel = await createIncident(
        workspace.id,
        {
          declaredAt: stale,
          commanderId: userId,
          slackTeamId: teamId,
          slackChannelId: "C_REM",
        },
        tx,
      );
      const byDm = await createIncident(
        workspace.id,
        { declaredAt: stale, commanderId: userId },
        tx,
      );
      await createIncidentEvent(byDm.id, { createdAt: stale }, tx);
      await createSlackUser(
        workspace.id,
        userId,
        { slackTeamId: teamId, slackUserId: "U_COMMANDER" },
        tx,
      );
      const fresh = await createIncident(workspace.id, {}, tx);
      await createIncidentEvent(fresh.id, { createdAt: new Date() }, tx);

      const { client, sent } = fakeClient();
      const claims = memoryClaim();
      const run = () =>
        remindStaleIncidents({
          db: tx,
          clientFor: () => client,
          ...claims,
          dashboardUrl: "https://app.test",
        });

      const results = await run();
      const mine = (id: number) => results.find((r) => r.incidentId === id);
      expect(mine(inChannel.id)?.target).toEqual({
        kind: "channel",
        channel: "C_REM",
      });
      expect(mine(byDm.id)?.target).toEqual({
        kind: "dm",
        slackUserId: "U_COMMANDER",
        role: "commander",
      });
      expect(mine(fresh.id)).toBeUndefined();
      expect(sent.map((m) => m.channel).sort()).toEqual(
        ["C_REM", "U_COMMANDER"].sort(),
      );

      await run();
      expect(sent).toHaveLength(2);
    });
  });

  test("nobody linked: reported once per window with no target", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = `T_REM_${crypto.randomUUID()}`;
      await connect(tx, teamId);
      const row = await createIncident(
        workspace.id,
        { declaredAt: new Date(Date.now() - 30 * HOUR), severity: "minor" },
        tx,
      );
      const { client, sent } = fakeClient();
      const claims = memoryClaim();
      const run = () =>
        remindStaleIncidents({
          db: tx,
          clientFor: () => client,
          ...claims,
          dashboardUrl: "https://app.test",
        });
      expect((await run()).find((r) => r.incidentId === row.id)).toEqual({
        incidentId: row.id,
        target: null,
        sent: false,
      });
      expect(
        (await run()).find((r) => r.incidentId === row.id),
      ).toBeUndefined();
      expect(sent).toHaveLength(0);
    });
  });

  function failingClient(error: unknown) {
    let calls = 0;
    const client = {
      chat: {
        postMessage: async () => {
          calls++;
          if (calls === 1) throw error;
          return { ok: true, ts: "1.1" };
        },
      },
    } as unknown as SlackIncidentClient;
    return { client, calls: () => calls };
  }

  async function staleChannelIncident(tx: DB) {
    const teamId = `T_REM_${crypto.randomUUID()}`;
    await connect(tx, teamId);
    return createIncident(
      workspace.id,
      {
        declaredAt: new Date(Date.now() - 5 * HOUR),
        slackTeamId: teamId,
        slackChannelId: "C_FAIL",
      },
      tx,
    );
  }

  test("transient slack failure: not sent, retried on the next tick", async () => {
    await withTestTransaction(async (tx) => {
      const row = await staleChannelIncident(tx);
      const { client, calls } = failingClient(
        Object.assign(new Error("socket hang up"), {
          code: "slack_webapi_request_error",
        }),
      );
      const claims = memoryClaim();
      const run = () =>
        remindStaleIncidents({
          db: tx,
          clientFor: () => client,
          ...claims,
          dashboardUrl: "https://app.test",
        });
      expect((await run()).find((r) => r.incidentId === row.id)?.sent).toBe(
        false,
      );
      expect((await run()).find((r) => r.incidentId === row.id)?.sent).toBe(
        true,
      );
      expect(calls()).toBe(2);
    });
  });

  test("slack platform error: not sent, window stays claimed", async () => {
    await withTestTransaction(async (tx) => {
      const row = await staleChannelIncident(tx);
      const { client, calls } = failingClient(
        Object.assign(new Error("channel_not_found"), {
          code: "slack_webapi_platform_error",
        }),
      );
      const claims = memoryClaim();
      const run = () =>
        remindStaleIncidents({
          db: tx,
          clientFor: () => client,
          ...claims,
          dashboardUrl: "https://app.test",
        });
      expect((await run()).find((r) => r.incidentId === row.id)?.sent).toBe(
        false,
      );
      expect(
        (await run()).find((r) => r.incidentId === row.id),
      ).toBeUndefined();
      expect(calls()).toBe(1);
    });
  });

  test("install without chat:write: nothing claimed or sent", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = `T_REM_${crypto.randomUUID()}`;
      await connect(
        tx,
        teamId,
        SLACK_BOT_SCOPES.filter((s) => s !== "chat:write"),
      );
      const row = await createIncident(
        workspace.id,
        {
          declaredAt: new Date(Date.now() - 5 * HOUR),
          slackTeamId: teamId,
          slackChannelId: "C_NOSCOPE",
        },
        tx,
      );
      const claimed: string[] = [];
      const { client, sent } = fakeClient();
      const results = await remindStaleIncidents({
        db: tx,
        clientFor: () => client,
        claim: async (key) => {
          claimed.push(key);
          return true;
        },
        release: async () => {},
        dashboardUrl: "https://app.test",
      });
      expect(results.find((r) => r.incidentId === row.id)).toBeUndefined();
      expect(
        claimed.some((k) => k.startsWith(`incident:reminder:${row.id}:`)),
      ).toBe(false);
      expect(sent).toHaveLength(0);
    });
  });
});
