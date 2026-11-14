import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeMcpCtx,
  makeSlackCtx,
  makeSystemCtx,
  makeUserCtx,
  expectAuditRow,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ConflictError, ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  declareIncident,
  getIncident,
  listIncidentEvents,
  setIncidentStatus,
} from "../index";

let workspace: Workspace;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("free");
  workspace = fixture.workspace;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, workspace.id, "member");
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});

function declareAs(ctx: ServiceContext, tx: DB) {
  return declareIncident({
    ctx: withDb(ctx, tx),
    input: { title: "API down", severity: "major" },
  });
}

describe("acknowledgement at declare", () => {
  test("a dashboard declare is acknowledged at declare by that person", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declareAs(
        makeUserCtx(workspace, { userId: memberId }),
        tx,
      );
      expect(row.acknowledgedAt?.getTime()).toBe(row.declaredAt.getTime());
      expect(row.acknowledgedBy).toBe(memberId);
    });
  });

  test("a Slack declare is acknowledged at declare by the linked member", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declareAs(
        makeSlackCtx(workspace, {
          teamId: "T1",
          slackUserId: "U1",
          userId: memberId,
        }),
        tx,
      );
      expect(row.acknowledgedAt?.getTime()).toBe(row.declaredAt.getTime());
      expect(row.acknowledgedBy).toBe(memberId);
    });
  });

  test.each([
    ["an API key", () => makeApiKeyCtx(workspace, { keyId: "k1" })],
    [
      "an API key owned by a user",
      () => makeApiKeyCtx(workspace, { keyId: "k2", userId: memberId }),
    ],
    [
      "an MCP key owned by a user",
      () => makeMcpCtx(workspace, { keyId: "k3", userId: memberId }),
    ],
    ["the system", () => makeSystemCtx(workspace, { job: "test" })],
  ])("a declare by %s starts unacknowledged", async (_, ctx) => {
    await withTestTransaction(async (tx) => {
      const row = await declareAs(ctx(), tx);
      expect(row.acknowledgedAt).toBeNull();
      expect(row.acknowledgedBy).toBeNull();
    });
  });
});

describe("acknowledgeIncident", () => {
  const apiKey = () => makeApiKeyCtx(workspace, { keyId: "k_declare" });
  const member = () => makeUserCtx(workspace, { userId: memberId });

  test("acknowledges an unacknowledged incident on a free plan, with event and audit row", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareAs(apiKey(), tx);
      const before = Date.now();
      const row = await acknowledgeIncident({
        ctx: withDb(member(), tx),
        input: { id: declared.id },
      });
      expect(row.acknowledgedBy).toBe(memberId);
      expect(row.acknowledgedAt?.getTime()).toBeGreaterThanOrEqual(
        Math.floor(before / 1000) * 1000,
      );

      const events = await listIncidentEvents({
        ctx: withDb(member(), tx),
        input: { id: declared.id },
      });
      const ack = events.filter((e) => e.type === "acknowledged");
      expect(ack).toHaveLength(1);
      expect(ack[0]?.createdBy).toBe(memberId);
      expect(ack[0]?.source).toBe("dashboard");

      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident.update",
        entityType: "incident",
        entityId: declared.id,
        actorType: "user",
        db: tx,
      });

      const view = await getIncident({
        ctx: withDb(member(), tx),
        input: { id: declared.id },
      });
      expect(view?.acknowledgedByUser?.id).toBe(memberId);
    });
  });

  test("an API key without a user acknowledges as nobody", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareAs(apiKey(), tx);
      const row = await acknowledgeIncident({
        ctx: withDb(makeApiKeyCtx(workspace, { keyId: "k_ack" }), tx),
        input: { id: declared.id },
      });
      expect(row.acknowledgedAt).not.toBeNull();
      expect(row.acknowledgedBy).toBeNull();
    });
  });

  test("a second acknowledge conflicts and writes no second event", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareAs(member(), tx);
      await expect(
        acknowledgeIncident({
          ctx: withDb(member(), tx),
          input: { id: declared.id },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      const events = await listIncidentEvents({
        ctx: withDb(member(), tx),
        input: { id: declared.id },
      });
      expect(events.some((e) => e.type === "acknowledged")).toBe(false);
    });
  });

  test("a closed incident conflicts", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareAs(apiKey(), tx);
      await setIncidentStatus({
        ctx: withDb(apiKey(), tx),
        input: { id: declared.id, status: "canceled" },
      });
      await expect(
        acknowledgeIncident({
          ctx: withDb(member(), tx),
          input: { id: declared.id },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("rejects read-only actor", async () => {
    await expect(
      acknowledgeIncident({
        ctx: makeApiKeyCtx(workspace, { keyId: "k_ro", scopes: ["read"] }),
        input: { id: 1 },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
