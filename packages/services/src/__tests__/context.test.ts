import { db, eq } from "@openstatus/db";
import { monitor, page } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../test/helpers";
import { type DB, batchReads, isTx } from "../context";

// `batchReads` has two implementations behind one signature: `db.batch()`
// (one libsql round-trip) outside a transaction, `Promise.all` inside one.
// Every other suite runs its body in `withTestTransaction`, so the batch
// branch would never be covered — these tests drive the committed db on
// purpose so both branches are exercised and compared.

let workspaceId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspaceId = fixture.workspace.id;

  await db.insert(page).values([
    {
      workspaceId,
      title: "batch-reads-a",
      description: "",
      slug: `svc-batch-a-${workspaceId}`,
      customDomain: "",
    },
    {
      workspaceId,
      title: "batch-reads-b",
      description: "",
      slug: `svc-batch-b-${workspaceId}`,
      customDomain: "",
    },
  ]);
  await db.insert(monitor).values({
    workspaceId,
    url: "https://example.openstatus.dev",
    name: "batch-reads-monitor",
  });
});

const pagesOf = (conn: DB) =>
  conn.select().from(page).where(eq(page.workspaceId, workspaceId));

const monitorsOf = (conn: DB) =>
  conn.select().from(monitor).where(eq(monitor.workspaceId, workspaceId));

describe("batchReads", () => {
  test("the committed client is not a tx, the test wrapper's handle is", async () => {
    // Guards the premise of every other case here: if this flipped, the
    // batch branch would silently stop being covered.
    expect(isTx(db)).toBe(false);
    await withTestTransaction(async (tx) => {
      expect(isTx(tx)).toBe(true);
    });
  });

  test("returns one result per query, positionally", async () => {
    const [pages, monitors] = await batchReads(db, [
      pagesOf(db),
      monitorsOf(db),
    ]);

    expect(pages).toHaveLength(2);
    expect(monitors).toHaveLength(1);
    // Shape, not just length — a transposed batch would still be 2 then 1
    // if both tables happened to have matching row counts.
    expect(pages.every((r) => "slug" in r)).toBe(true);
    expect(monitors.every((r) => "periodicity" in r)).toBe(true);
  });

  test("batch path matches awaiting each query on its own", async () => {
    const [batchedPages, batchedMonitors] = await batchReads(db, [
      pagesOf(db),
      monitorsOf(db),
    ]);
    const serialPages = await pagesOf(db);
    const serialMonitors = await monitorsOf(db);

    expect(batchedPages.map((p) => p.id)).toEqual(serialPages.map((p) => p.id));
    expect(batchedMonitors.map((m) => m.id)).toEqual(
      serialMonitors.map((m) => m.id),
    );
  });

  test("in-transaction fallback returns the same results as the batch path", async () => {
    const [batchedPages, batchedMonitors] = await batchReads(db, [
      pagesOf(db),
      monitorsOf(db),
    ]);

    await withTestTransaction(async (tx) => {
      const [txPages, txMonitors] = await batchReads(tx, [
        pagesOf(tx),
        monitorsOf(tx),
      ]);
      expect(txPages.map((p) => p.id)).toEqual(batchedPages.map((p) => p.id));
      expect(txMonitors.map((m) => m.id)).toEqual(
        batchedMonitors.map((m) => m.id),
      );
    });
  });

  test("inside a tx it observes writes made earlier in that tx", async () => {
    await withTestTransaction(async (tx) => {
      const [before] = await batchReads(tx, [pagesOf(tx)]);
      await tx.insert(page).values({
        workspaceId,
        title: "batch-reads-in-tx",
        description: "",
        slug: `svc-batch-tx-${workspaceId}`,
        customDomain: "",
      });
      const [after] = await batchReads(tx, [pagesOf(tx)]);
      expect(after).toHaveLength(before.length + 1);
    });
  });

  test("accepts a single-query batch", async () => {
    const [pages] = await batchReads(db, [pagesOf(db)]);
    expect(pages).toHaveLength(2);
  });
});
