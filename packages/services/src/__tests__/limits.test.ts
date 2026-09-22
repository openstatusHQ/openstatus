import { eq } from "@openstatus/db";
import {
  monitor,
  monitorRun,
  notification,
  page,
  pageComponent,
  workspace,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../test/helpers";
import type { DrizzleTx } from "../context";
import { LimitExceededError } from "../errors";
import { LIMIT_KEYS, type LimitKey, assertWithinLimit } from "../limits";

const TEST_PREFIX = "svc-limits-test";

let workspaceId: number;
let seq = 0;
const unique = () => `${TEST_PREFIX}-${workspaceId}-${seq++}`;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

/** Pin one limit for the workspace so a case controls its own ceiling. */
async function setLimit(tx: DrizzleTx, limit: LimitKey, max: number) {
  await tx
    .update(workspace)
    .set({ limits: JSON.stringify({ [limit]: max }) })
    .where(eq(workspace.id, workspaceId));
}

function within(limit: LimitKey, delta?: number) {
  return (tx: DrizzleTx) =>
    assertWithinLimit({ tx, workspaceId, limit, delta });
}

async function addMonitor(tx: DrizzleTx, overrides: { deletedAt?: Date } = {}) {
  return tx
    .insert(monitor)
    .values({
      workspaceId,
      url: "https://example.openstatus.dev",
      name: unique(),
      ...overrides,
    })
    .returning()
    .get();
}

async function addPage(tx: DrizzleTx) {
  return tx
    .insert(page)
    .values({
      workspaceId,
      title: unique(),
      description: "",
      // `slug` is globally unique, not per-workspace.
      slug: unique(),
      customDomain: "",
    })
    .returning()
    .get();
}

async function addRun(tx: DrizzleTx, monitorId: number, createdAt: Date) {
  await tx
    .insert(monitorRun)
    .values({ workspaceId, monitorId, runnedAt: new Date(), createdAt });
}

describe("countCurrent coverage", () => {
  // The real guard is the `never` in countCurrent's default branch, which
  // makes an uncounted LimitKey a type error. This is its runtime twin: it
  // fails if a key is listed but its case never runs a query.
  for (const limit of LIMIT_KEYS) {
    test(`counts "${limit}" instead of throwing not-implemented`, async () => {
      await withTestTransaction(async (tx) => {
        await setLimit(tx, limit, 1_000_000);
        await expect(within(limit)(tx)).resolves.toBeUndefined();
      });
    });
  }

  test("every LimitKey resolves to a numeric plan limit", async () => {
    const { limits } = (await createWorkspaceFixture("free")).workspace;
    for (const limit of LIMIT_KEYS) {
      expect(typeof limits[limit]).toBe("number");
    }
  });
});

describe("assertWithinLimit boundaries", () => {
  test("monitors: counts live rows, ignores soft-deleted ones", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "monitors", 2);
      await addMonitor(tx);
      await addMonitor(tx, { deletedAt: new Date() });

      // 1 live + 1 tombstoned: the tombstone must not consume quota.
      await expect(within("monitors")(tx)).resolves.toBeUndefined();

      await addMonitor(tx);
      await expect(within("monitors")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("status-pages: trips once the workspace is full", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "status-pages", 1);
      await expect(within("status-pages")(tx)).resolves.toBeUndefined();

      await addPage(tx);
      await expect(within("status-pages")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("page-components: counts across every page in the workspace", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "page-components", 2);
      const pageA = await addPage(tx);
      const pageB = await addPage(tx);
      const values = (pageId: number) => ({
        workspaceId,
        pageId,
        type: "static" as const,
        name: unique(),
        order: 0,
      });

      await tx.insert(pageComponent).values(values(pageA.id));
      await expect(within("page-components")(tx)).resolves.toBeUndefined();

      // The second component sits on a different page — a per-page count
      // would still see room here.
      await tx.insert(pageComponent).values(values(pageB.id));
      await expect(within("page-components")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("notification-channels: trips once the workspace is full", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "notification-channels", 1);
      await expect(
        within("notification-channels")(tx),
      ).resolves.toBeUndefined();

      await tx.insert(notification).values({
        workspaceId,
        name: unique(),
        provider: "email",
        data: JSON.stringify({ email: "limits@openstatus.dev" }),
      });
      await expect(within("notification-channels")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("synthetic-checks: meters the rolling month, not all history", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "synthetic-checks", 1);
      const mon = await addMonitor(tx);
      const stale = new Date();
      stale.setMonth(stale.getMonth() - 2);

      // Older than the window: spent quota, but not this month's.
      await addRun(tx, mon.id, stale);
      await expect(within("synthetic-checks")(tx)).resolves.toBeUndefined();

      await addRun(tx, mon.id, new Date());
      await expect(within("synthetic-checks")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("delta reserves more than one slot at a time", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "monitors", 3);
      await addMonitor(tx);

      await expect(within("monitors", 2)(tx)).resolves.toBeUndefined();
      await expect(within("monitors", 3)(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );
    });
  });

  test("the error carries both the ceiling and the current usage", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "monitors", 1);
      await addMonitor(tx);

      const err = await within("monitors")(tx).catch((e) => e);
      expect(err).toBeInstanceOf(LimitExceededError);
      expect(err.max).toBe(1);
      expect(err.current).toBe(1);
    });
  });

  test("reads limits from the db, not a stale caller snapshot", async () => {
    await withTestTransaction(async (tx) => {
      await setLimit(tx, "monitors", 1);
      await addMonitor(tx);
      await expect(within("monitors")(tx)).rejects.toBeInstanceOf(
        LimitExceededError,
      );

      // An add-on purchased mid-request lands as a workspace-row override.
      await setLimit(tx, "monitors", 5);
      await expect(within("monitors")(tx)).resolves.toBeUndefined();
    });
  });
});
