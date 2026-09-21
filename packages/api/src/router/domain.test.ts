import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { vercelFetch } from "../lib/vercel";
import { createInnerTRPCContext } from "../trpc";

const otherDomain = "domain-idor-test.openstatus.dev";
let otherPageId: number;

function getCaller() {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal user for test
    user: { id: 1 },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  return edgeRouter.createCaller(ctx);
}

beforeAll(async () => {
  const row = await db
    .insert(page)
    .values({
      workspaceId: 3,
      title: "domain idor test",
      description: "",
      slug: "domain-idor-test",
      customDomain: otherDomain,
    })
    .returning()
    .get();
  otherPageId = row.id;
});

afterAll(async () => {
  await db.delete(page).where(eq(page.id, otherPageId));
});

for (const procedure of [
  "getDomainResponse",
  "getConfigResponse",
  "verifyDomain",
] as const) {
  test(`domain.${procedure} rejects another workspace's domain`, async () => {
    const error = await getCaller()
      .domain[procedure]({ domain: otherDomain })
      .catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("NOT_FOUND");
  });

  test(`domain.${procedure} rejects a traversal payload`, async () => {
    const error = await getCaller()
      .domain[procedure]({ domain: "../../../../v2/user#" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect(["BAD_REQUEST", "NOT_FOUND"]).toContain((error as TRPCError).code);
  });
}

for (const path of [
  "/v9/projects/p/domains/../../../../v2/user",
  "/v9/projects/p/domains/%2e%2e/%2e%2e/x",
  "/v9/projects/p/domains/a.com#?teamId=t",
  "//evil.example/v2/user",
]) {
  test(`vercelFetch refuses ${path}`, async () => {
    const error = await vercelFetch(path).catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
  });
}
