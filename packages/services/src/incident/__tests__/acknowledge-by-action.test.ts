import { statusReport } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSlackCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import type { Workspace } from "../../types";
import {
  addIncidentNote,
  declareIncident,
  getIncident,
  linkIncidentStatusReport,
  listIncidentEvents,
  setIncidentStatus,
  updateIncident,
} from "../index";

let workspace: Workspace;
let memberId: number;
let otherId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("free");
  workspace = fixture.workspace;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, workspace.id, "member");
  otherId = (await createUser()).id;
  await addUserToWorkspace(otherId, workspace.id, "member");
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});
const member = () => makeUserCtx(workspace, { userId: memberId });
const slackMember = () =>
  makeSlackCtx(workspace, {
    teamId: "T1",
    slackUserId: "U1",
    userId: memberId,
  });
const apiKey = () => makeApiKeyCtx(workspace, { keyId: "k_auto" });
const userKey = () =>
  makeApiKeyCtx(workspace, { keyId: "k_user", userId: memberId });

function declareUnacknowledged(tx: DB) {
  return declareIncident({
    ctx: withDb(apiKey(), tx),
    input: { title: "API down", severity: "major" },
  });
}

async function view(tx: DB, id: number) {
  const row = await getIncident({ ctx: withDb(member(), tx), input: { id } });
  if (!row) throw new Error("incident missing");
  return row;
}

async function acknowledgedEvents(tx: DB, id: number) {
  const events = await listIncidentEvents({
    ctx: withDb(member(), tx),
    input: { id },
  });
  return events.filter((e) => e.type === "acknowledged");
}

// The DB stores seconds; compare against the second the write started in.
const secondFloor = (ms: number) => Math.floor(ms / 1000) * 1000;

describe("a note", () => {
  test.each([
    ["a dashboard user", member],
    ["a Slack user", slackMember],
  ])("by %s acknowledges, without an acknowledged event", async (_, ctx) => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const before = Date.now();
      await addIncidentNote({
        ctx: withDb(ctx(), tx),
        input: { id: declared.id, message: "Looking into it" },
      });
      const row = await view(tx, declared.id);
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt?.getTime()).toBeGreaterThanOrEqual(
        secondFloor(before),
      );
      expect(await acknowledgedEvents(tx, declared.id)).toHaveLength(0);
    });
  });

  test.each([
    ["an API key", apiKey],
    ["an API key owned by a user", userKey],
  ])("by %s does not acknowledge", async (_, ctx) => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      await addIncidentNote({
        ctx: withDb(ctx(), tx),
        input: { id: declared.id, message: "Automated update" },
      });
      const row = await view(tx, declared.id);
      expect(row.acknowledgedAt).toBeNull();
      expect(row.acknowledgedBy).toBeNull();
    });
  });

  test("backdated, acknowledges at the time of the write", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const before = Date.now();
      await addIncidentNote({
        ctx: withDb(member(), tx),
        input: {
          id: declared.id,
          message: "Said earlier in Slack",
          createdAt: new Date(before - 2 * 60 * 60 * 1000),
        },
      });
      const row = await view(tx, declared.id);
      expect(row.acknowledgedAt?.getTime()).toBeGreaterThanOrEqual(
        secondFloor(before),
      );
    });
  });

  test("does not move an earlier acknowledgement", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareIncident({
        ctx: withDb(member(), tx),
        input: { title: "API down", severity: "major" },
      });
      await addIncidentNote({
        ctx: withDb(makeUserCtx(workspace, { userId: otherId }), tx),
        input: { id: declared.id, message: "Me too" },
      });
      const row = await view(tx, declared.id);
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt?.getTime()).toBe(declared.declaredAt.getTime());
    });
  });
});

describe("a status change", () => {
  test("by a person acknowledges, and the verb returns the acknowledged row", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const row = await setIncidentStatus({
        ctx: withDb(member(), tx),
        input: { id: declared.id, status: "mitigated" },
      });
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt).not.toBeNull();
    });
  });

  test("to mitigated by an API key does not acknowledge", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const row = await setIncidentStatus({
        ctx: withDb(apiKey(), tx),
        input: { id: declared.id, status: "mitigated" },
      });
      expect(row.acknowledgedAt).toBeNull();
    });
  });

  test.each([
    ["an API key", apiKey, null],
    ["an API key owned by a user", userKey, "member"],
  ] as const)(
    "to resolved by %s acknowledges, without an acknowledged event",
    async (_, ctx, by) => {
      await withTestTransaction(async (tx) => {
        const declared = await declareUnacknowledged(tx);
        const before = Date.now();
        const row = await setIncidentStatus({
          ctx: withDb(ctx(), tx),
          input: { id: declared.id, status: "resolved" },
        });
        expect(row.acknowledgedAt?.getTime()).toBeGreaterThanOrEqual(
          secondFloor(before),
        );
        expect(row.acknowledgedBy).toBe(by === "member" ? memberId : null);
        expect(await acknowledgedEvents(tx, declared.id)).toHaveLength(0);
      });
    },
  );
});

describe("a severity change", () => {
  test("by a person acknowledges", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const row = await updateIncident({
        ctx: withDb(slackMember(), tx),
        input: { id: declared.id, severity: "critical" },
      });
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt).not.toBeNull();
    });
  });

  test("by an API key does not acknowledge", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const row = await updateIncident({
        ctx: withDb(userKey(), tx),
        input: { id: declared.id, severity: "critical" },
      });
      expect(row.acknowledgedAt).toBeNull();
    });
  });
});

describe("linking a status report", () => {
  test("by a person acknowledges", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareUnacknowledged(tx);
      const report = await tx
        .insert(statusReport)
        .values({
          workspaceId: workspace.id,
          title: "Outage",
          status: "investigating",
        })
        .returning()
        .get();
      const row = await linkIncidentStatusReport({
        ctx: withDb(member(), tx),
        input: { id: declared.id, statusReportId: report.id },
      });
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt).not.toBeNull();
      expect(await acknowledgedEvents(tx, declared.id)).toHaveLength(0);
    });
  });
});
