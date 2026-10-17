import { db, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { NextRequest } from "next/server.js";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

let workspaceId: number;
let pageId: number;
let slug: string;

function caller() {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal"),
      session: null,
    }),
  );
}

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspaceId = fixture.workspace.id;
  const _page = await createPage(workspaceId);
  pageId = _page.id;
  slug = _page.slug;
});

afterAll(async () => {
  await db.delete(pageSubscriber).where(eq(pageSubscriber.pageId, pageId));
  await db.delete(page).where(eq(page.workspaceId, workspaceId));
});

describe("statusPage.subscribe", () => {
  test("never returns the verification token to the caller", async () => {
    const result = await caller().statusPage.subscribe({
      slug,
      email: "someone-else@example.com",
      subscribeComponents: false,
      pageComponents: [],
    });

    expect(result?.id).toBeDefined();
    expect(result).not.toHaveProperty("token");

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, result?.id ?? -1),
    });
    expect(row?.token).toBeTruthy();
    expect(row?.acceptedAt).toBeNull();
    expect(JSON.stringify(result)).not.toContain(row?.token ?? "");
  });

  test("the public token-based verification email endpoint is gone", () => {
    expect(
      Object.keys(appRouter._def.procedures).filter((p) =>
        p.startsWith("emailRouter."),
      ),
    ).not.toContain("emailRouter.sendPageSubscriptionVerification");
  });
});
