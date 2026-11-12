import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { addMonitorSlaExcusedWindow } from "../add-excused-window";
import { archiveMonitorSlaPolicy } from "../archive";
import { createMonitorSlaPolicy } from "../create";
import { getMonitorSlaExcusedWindow } from "../get-excused-window";

const now = new Date(Date.UTC(2026, 10, 15, 12));
const oct = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h));

let ownerCtx: ServiceContext;
let otherCtx: ServiceContext;
let freeCtx: ServiceContext;
let ownerId: number;
let apiId: number;
const workspaceIds: number[] = [];

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const other = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  workspaceIds.push(team.workspace.id, other.workspace.id, free.workspace.id);
  ownerId = team.userId;
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  apiId = (
    await createMonitor(team.workspace.id, { name: "API", regions: "fra" })
  ).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function windowIn(tx: Tx) {
  const ctx = { ...ownerCtx, db: tx };
  const policy = await createMonitorSlaPolicy({
    ctx,
    input: { name: "Partner", target: 99_500, monitorIds: [apiId] },
  });
  const window = await addMonitorSlaExcusedWindow({
    ctx,
    input: {
      policyId: policy.id,
      kind: "third_party",
      reason: "Upstream DNS outage",
      from: oct(20, 22),
      to: oct(20, 23),
    },
    now,
  });
  return { policy, window };
}

describe("getMonitorSlaExcusedWindow", () => {
  test("returns the window with its policy", async () => {
    await withTestTransaction(async (tx) => {
      const { policy, window } = await windowIn(tx);

      const res = await getMonitorSlaExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { id: window.id },
      });

      expect(res).toEqual({
        id: window.id,
        kind: "third_party",
        reason: "Upstream DNS outage",
        from: oct(20, 22),
        to: oct(20, 23),
        createdBy: ownerId,
        createdAt: window.createdAt,
        policy: { id: policy.id, name: "Partner", archivedAt: null },
      });
    });
  });

  test("resolves a window of an archived policy", async () => {
    await withTestTransaction(async (tx) => {
      const { policy, window } = await windowIn(tx);
      await archiveMonitorSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input: { id: policy.id },
      });

      const res = await getMonitorSlaExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { id: window.id },
      });
      expect(res.policy.archivedAt).toBeInstanceOf(Date);
    });
  });

  test("another workspace's window is not found", async () => {
    await withTestTransaction(async (tx) => {
      const { window } = await windowIn(tx);
      await expect(
        getMonitorSlaExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input: { id: window.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("a read-only key can read; another group's key cannot", async () => {
    await withTestTransaction(async (tx) => {
      const { window } = await windowIn(tx);
      const read = makeApiKeyCtx(ownerCtx.workspace, {
        keyId: "k",
        scopes: ["read"],
      });
      const res = await getMonitorSlaExcusedWindow({
        ctx: { ...read, db: tx },
        input: { id: window.id },
      });
      expect(res.id).toBe(window.id);

      const pages = makeApiKeyCtx(ownerCtx.workspace, {
        keyId: "k",
        scopes: ["pages:read"],
      });
      await expect(
        getMonitorSlaExcusedWindow({
          ctx: { ...pages, db: tx },
          input: { id: window.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("refused without the limit", async () => {
    await expect(
      getMonitorSlaExcusedWindow({ ctx: freeCtx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
