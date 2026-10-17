import { db, eq } from "@openstatus/db";
import {
  page,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

test("page.updateCustomDomain rejects a taken domain before touching Vercel", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    workspace: selectWorkspaceSchema.parse(
      await db.select().from(workspace).where(eq(workspace.id, 1)).get(),
    ),
  });
  const caller = edgeRouter.createCaller(ctx);
  const before = await db.select().from(page).where(eq(page.id, 1)).get();

  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  // Count, never send: a regression must not reach the real Vercel API.
  globalThis.fetch = () => {
    fetchCalls++;
    return Promise.reject(new Error("unexpected Vercel request"));
  };
  try {
    await caller.page.updateCustomDomain({
      id: 1,
      // Seeded on page 2.
      customDomain: "status.acme.com",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("CONFLICT");
  } finally {
    globalThis.fetch = realFetch;
  }
  expect(fetchCalls).toBe(0);

  const after = await db.select().from(page).where(eq(page.id, 1)).get();
  expect(after?.customDomain).toBe(before?.customDomain);
});
