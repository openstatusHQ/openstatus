import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { vercelFetch } from "../lib/vercel";
import { createInnerTRPCContext } from "../trpc";

const otherDomain = "domain-idor-test.openstatus.dev";
let otherPageId: number;
let ownWorkspaceId: number;
let ownUserId: number;

function getCaller() {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: String(ownUserId) } },
    // @ts-expect-error - minimal user for test
    user: { id: ownUserId },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: ownWorkspaceId },
  });
  return edgeRouter.createCaller(ctx);
}

beforeAll(async () => {
  const own = await createTestWorkspace();
  ownWorkspaceId = own.workspace.id;
  ownUserId = own.user.id;
  const other = await createTestWorkspace();

  const row = await db
    .insert(page)
    .values({
      workspaceId: other.workspace.id,
      title: "domain idor test",
      description: "",
      slug: `domain-idor-test-${other.workspace.id}`,
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

test("domain.getDomainResponse reaches Vercel for the workspace's own domain", async () => {
  const ownDomain = `own-${ownWorkspaceId}.openstatus.dev`;
  const own = await db
    .insert(page)
    .values({
      workspaceId: ownWorkspaceId,
      title: "own domain test",
      description: "",
      slug: `domain-own-test-${ownWorkspaceId}`,
      customDomain: ownDomain,
    })
    .returning()
    .get();

  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (input) => {
    requested = String(input);
    return Promise.resolve(Response.json({ name: ownDomain, verified: true }));
  };
  try {
    const result = await getCaller().domain.getDomainResponse({
      domain: ownDomain.toUpperCase(),
    });
    expect(result?.verified).toBe(true);
    expect(
      new URL(requested).pathname.endsWith(
        `/domains/${ownDomain.toUpperCase()}`,
      ),
    ).toBe(true);
  } finally {
    globalThis.fetch = original;
    await db.delete(page).where(eq(page.id, own.id));
  }
});

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
