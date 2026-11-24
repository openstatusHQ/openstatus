import { db, inArray } from "@openstatus/db";
import {
  invitation,
  monitor,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

let caller: ReturnType<typeof appRouter.createCaller>;
let ownMonitorId: number;
let foreignMonitorId: number;
let foreignInvitationId: number;

beforeAll(async () => {
  const own = await createTestWorkspace();
  const other = await createTestWorkspace();
  ownMonitorId = (await createMonitor(own.workspace.id)).id;
  foreignMonitorId = (await createMonitor(other.workspace.id)).id;
  const inv = await db
    .insert(invitation)
    .values({
      email: "boundary-test@acme.com",
      workspaceId: other.workspace.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning()
    .get();
  foreignInvitationId = inv.id;

  caller = appRouter.createCaller(
    createInnerTRPCContext({
      req: undefined,
      session: { user: { id: String(own.user.id) } },
      // @ts-expect-error - minimal user for test
      user: { id: own.user.id, email: "owner@acme.com" },
      workspace: selectWorkspaceSchema.parse(own.workspace),
    }),
  );
});

afterAll(async () => {
  await db
    .delete(monitor)
    .where(inArray(monitor.id, [ownMonitorId, foreignMonitorId]));
  await db
    .delete(invitation)
    .where(inArray(invitation.id, [foreignInvitationId]));
});

async function codeOf(p: Promise<unknown>) {
  const err = await p.then(() => null).catch((e) => e);
  return err instanceof TRPCError ? err.code : err;
}

describe("routers reject another workspace's records", () => {
  test("checker.triggerChecker", async () => {
    expect(
      await codeOf(caller.checker.triggerChecker({ id: foreignMonitorId })),
    ).toBe("NOT_FOUND");
    // Outside production the checker call is a no-op, so this only proves access.
    expect(
      await codeOf(caller.checker.triggerChecker({ id: ownMonitorId })),
    ).toBeNull();
  });

  test("tinybird.globalMetrics", async () => {
    expect(
      await codeOf(
        caller.tinybird.globalMetrics({
          monitorIds: [String(ownMonitorId), String(foreignMonitorId)],
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  test("tinybird.metricsLatency", async () => {
    expect(
      await codeOf(
        caller.tinybird.metricsLatency({
          monitorId: String(foreignMonitorId),
          period: "1d",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  test("emailRouter.sendTeamInvitation is a silent no-op", async () => {
    expect(
      await caller.emailRouter.sendTeamInvitation({ id: foreignInvitationId }),
    ).toBeUndefined();
  });
});
