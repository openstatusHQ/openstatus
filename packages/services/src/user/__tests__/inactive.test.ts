import { session } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import { withTestTransaction } from "../../../test/helpers";
import type { DrizzleTx } from "../../context";
import {
  getFreeWorkspaceOfUser,
  getLatestSessionExpiry,
  getUserContact,
  listFreeUsersLastSeenBefore,
  listFreeUsersWithoutSession,
} from "../index.ts";

const DAY_MS = 86_400_000;

async function logIn(tx: DrizzleTx, userId: number, expires: Date) {
  await tx
    .insert(session)
    .values({ sessionToken: `test-${crypto.randomUUID()}`, userId, expires })
    .run();
}

describe("inactive free users", () => {
  test("without a session: free members only, updated before the cutoff", async () => {
    await withTestTransaction(async (tx) => {
      const free = await createTestWorkspace({ plan: "free" }, tx);
      const team = await createTestWorkspace({ plan: "team" }, tx);
      const withSession = await createTestWorkspace({ plan: "free" }, tx);
      await logIn(tx, withSession.user.id, new Date(Date.now() - DAY_MS));

      const ids = async (before: Date) =>
        (await listFreeUsersWithoutSession({ before, db: tx })).map(
          (r) => r.userId,
        );

      const later = await ids(new Date(Date.now() + DAY_MS));
      expect(later).toContain(free.user.id);
      expect(later).not.toContain(team.user.id);
      expect(later).not.toContain(withSession.user.id);

      expect(await ids(new Date(Date.now() - DAY_MS))).not.toContain(
        free.user.id,
      );
    });
  });

  test("last seen before: judged by the latest session only", async () => {
    await withTestTransaction(async (tx) => {
      const stale = await createTestWorkspace({ plan: "free" }, tx);
      await logIn(tx, stale.user.id, new Date(Date.now() - 90 * DAY_MS));
      const returned = await createTestWorkspace({ plan: "free" }, tx);
      await logIn(tx, returned.user.id, new Date(Date.now() - 90 * DAY_MS));
      await logIn(tx, returned.user.id, new Date(Date.now() + DAY_MS));
      const team = await createTestWorkspace({ plan: "team" }, tx);
      await logIn(tx, team.user.id, new Date(Date.now() - 90 * DAY_MS));

      const rows = await listFreeUsersLastSeenBefore({
        before: new Date(Date.now() - 60 * DAY_MS),
        db: tx,
      });
      const ids = rows.map((r) => r.userId);
      expect(ids).toContain(stale.user.id);
      expect(ids).not.toContain(returned.user.id);
      expect(ids).not.toContain(team.user.id);
      expect(rows.find((r) => r.userId === stale.user.id)).toEqual({
        userId: stale.user.id,
        email: stale.user.email,
        workspaceId: stale.workspace.id,
      });
    });
  });

  test("latest session expiry, contact and free workspace", async () => {
    await withTestTransaction(async (tx) => {
      const free = await createTestWorkspace({ plan: "free" }, tx);
      const team = await createTestWorkspace({ plan: "team" }, tx);
      const userId = free.user.id;

      expect(await getLatestSessionExpiry({ userId, db: tx })).toBeNull();
      const latest = new Date(Math.floor(Date.now() / 1000) * 1000 + DAY_MS);
      await logIn(tx, userId, new Date(latest.getTime() - 2 * DAY_MS));
      await logIn(tx, userId, latest);
      expect(await getLatestSessionExpiry({ userId, db: tx })).toEqual(latest);

      expect(await getUserContact({ userId, db: tx })).toEqual({
        id: userId,
        email: free.user.email,
      });
      expect(await getUserContact({ userId: -1, db: tx })).toBeUndefined();

      expect((await getFreeWorkspaceOfUser({ userId, db: tx }))?.id).toBe(
        free.workspace.id,
      );
      expect(
        await getFreeWorkspaceOfUser({ userId: team.user.id, db: tx }),
      ).toBeUndefined();
    });
  });
});
