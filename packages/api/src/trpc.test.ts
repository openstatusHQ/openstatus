import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { NextRequest } from "next/server.js";

import type { ResolveActiveWorkspaceResult } from "./auth/resolve-active-workspace";
import {
  createInnerTRPCContext,
  createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
} from "./trpc";

const testRouter = createTRPCRouter({
  whoami: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.user.id,
    workspaceSlug: ctx.workspace.slug,
  })),
});

function makeRequest(cookie?: string) {
  return new NextRequest("http://localhost:3000/api/trpc/lambda", {
    headers: cookie ? { cookie } : undefined,
  });
}

test("protected procedure rejects without a session", async () => {
  const ctx = createInnerTRPCContext({ session: null });
  const caller = testRouter.createCaller(ctx);

  await expect(caller.whoami()).rejects.toThrow("UNAUTHORIZED");
});

test("protected procedure resolves seeded user and workspace", async () => {
  const ctx = await createTRPCContext({
    req: makeRequest("workspace-slug=love-openstatus"),
    auth: async () => ({ user: { id: "1" } }),
  });
  const caller = testRouter.createCaller(ctx);

  const result = await caller.whoami();

  expect(result).toEqual({ userId: 1, workspaceSlug: "love-openstatus" });
});

test("falls back to the first workspace when the cookie slug is stale", async () => {
  const ctx = await createTRPCContext({
    req: makeRequest("workspace-slug=does-not-exist"),
    auth: async () => ({ user: { id: "1" } }),
  });
  const caller = testRouter.createCaller(ctx);

  const result = await caller.whoami();

  expect(result).toEqual({ userId: 1, workspaceSlug: "love-openstatus" });
});

test("resolveWorkspace memoizes the resolution within one request context", async () => {
  const ctx = await createTRPCContext({
    req: makeRequest(),
    auth: async () => ({ user: { id: "1" } }),
  });

  const first = ctx.resolveWorkspace?.();
  const second = ctx.resolveWorkspace?.();

  expect(second).toBe(first);

  const resolved = await first;
  expect(resolved?.ok).toBe(true);
});

test("resolveWorkspace is not shared across request contexts", async () => {
  const auth = async () => ({ user: { id: "1" } });
  const a = await createTRPCContext({ req: makeRequest(), auth });
  const b = await createTRPCContext({ req: makeRequest(), auth });

  const resolvedA = a.resolveWorkspace?.();
  const resolvedB = b.resolveWorkspace?.();

  expect(resolvedB).not.toBe(resolvedA);
  await Promise.all([resolvedA, resolvedB]);
});

test("middleware uses the context resolver instead of querying directly", async () => {
  let calls = 0;
  const resolveWorkspace = (): Promise<ResolveActiveWorkspaceResult> => {
    calls++;
    // safe because the middleware only reads user.id and workspace.slug
    return Promise.resolve({
      ok: true,
      value: { user: { id: 42 }, workspace: { slug: "stubbed-workspace" } },
    } as unknown as ResolveActiveWorkspaceResult);
  };

  const ctx = createInnerTRPCContext({
    session: { user: { id: "42" } },
    resolveWorkspace,
  });
  const caller = testRouter.createCaller(ctx);

  const result = await caller.whoami();

  expect(result).toEqual({ userId: 42, workspaceSlug: "stubbed-workspace" });
  expect(calls).toBe(1);
});

test("middleware surfaces workspace_not_found as UNAUTHORIZED", async () => {
  const resolveWorkspace = (): Promise<ResolveActiveWorkspaceResult> =>
    Promise.resolve({ ok: false, error: { kind: "workspace_not_found" } });

  const ctx = createInnerTRPCContext({
    session: { user: { id: "42" } },
    resolveWorkspace,
  });
  const caller = testRouter.createCaller(ctx);

  await expect(caller.whoami()).rejects.toThrow("Workspace Not Found");
});
