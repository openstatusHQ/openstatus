import { beforeAll, describe, expect, test } from "bun:test";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../test/fixtures";
import { loadSeededWorkspace } from "../../test/helpers";
import type { DB, ServiceContext } from "../context";
import { isTx, withTransaction } from "../context";

describe("withTransaction", () => {
  let ctx: ServiceContext;

  beforeAll(async () => {
    const workspace = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
    ctx = {
      workspace,
      actor: { type: "user", userId: 1 },
    };
  });

  test("opens a tx when ctx.db is a client", async () => {
    let received: DB | undefined;
    const result = await withTransaction(ctx, async (tx) => {
      received = tx;
      return 42;
    });
    expect(result).toBe(42);
    expect(received).toBeDefined();
    expect(isTx(received as DB)).toBe(true);
  });

  test("reuses ctx.db when it is already a tx (identity preserved)", async () => {
    await withTransaction(ctx, async (outerTx) => {
      let reusedTx: DB | undefined;
      await withTransaction({ ...ctx, db: outerTx }, async (innerTx) => {
        reusedTx = innerTx;
      });
      expect(reusedTx).toBe(outerTx);
    });
  });

  test("nested withTransaction calls all reuse the outermost tx", async () => {
    await withTransaction(ctx, async (level1) => {
      await withTransaction({ ...ctx, db: level1 }, async (level2) => {
        await withTransaction({ ...ctx, db: level2 }, async (level3) => {
          expect(level3).toBe(level1);
          expect(level2).toBe(level1);
        });
      });
    });
  });

  test("error thrown inside reused tx propagates to outer caller", async () => {
    const outerPromise = withTransaction(ctx, async (outerTx) => {
      await withTransaction({ ...ctx, db: outerTx }, async () => {
        throw new Error("boom");
      });
    });
    await expect(outerPromise).rejects.toThrow("boom");
  });
});
