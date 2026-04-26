import { afterAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { auditLog } from "@openstatus/db/src/schema";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../test/fixtures";
import { withTestTransaction } from "../../test/helpers";

const SENTINEL_ENTITY_ID = `with-test-transaction-sanity-${Date.now()}`;

describe("withTestTransaction", () => {
  afterAll(async () => {
    // Defensive: if the rollback failed, the inserted row would leak.
    // Clean it up so a regression doesn't pollute future runs.
    await db
      .delete(auditLog)
      .where(eq(auditLog.entityId, SENTINEL_ENTITY_ID))
      .catch(() => undefined);
  });

  test("rolls back inserts so they never reach committed db", async () => {
    let visibleInsideTx = false;

    await withTestTransaction(async (tx) => {
      await tx.insert(auditLog).values({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        actorType: "system",
        actorId: "with-test-transaction-sanity",
        action: "monitor.create",
        entityType: "monitor",
        entityId: SENTINEL_ENTITY_ID,
      });

      const inTxRows = await tx
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, SENTINEL_ENTITY_ID))
        .all();
      visibleInsideTx = inTxRows.length === 1;
    });

    expect(visibleInsideTx).toBe(true);

    const committedRows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, SENTINEL_ENTITY_ID))
      .all();
    expect(committedRows).toHaveLength(0);
  });

  test("propagates non-sentinel errors thrown inside the callback", async () => {
    const promise = withTestTransaction(async () => {
      throw new Error("boom");
    });
    await expect(promise).rejects.toThrow("boom");
  });

  test("returns the callback's return value", async () => {
    const value = await withTestTransaction(async () => 42);
    expect(value).toBe(42);
  });
});
