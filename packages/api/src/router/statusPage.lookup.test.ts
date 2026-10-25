import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { NextRequest } from "next/server.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

let workspaceId: number;
let pageId: number;
let slug: string;
const customDomain = `status-${Date.now()}.lookup-test.dev`;

const caller = () =>
  appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal"),
      session: null,
    }),
  );

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspaceId = fixture.workspace.id;
  const _page = await createPage(workspaceId, { customDomain });
  pageId = _page.id;
  slug = _page.slug;
});

afterAll(async () => {
  await db.delete(page).where(eq(page.workspaceId, workspaceId));
});

describe("statusPage lookup by slug or custom domain", () => {
  test("resolves a page by its slug", async () => {
    const result = await caller().statusPage.get({ slug });
    expect(result?.id).toBe(pageId);
  });

  test("resolves the same page by its custom domain", async () => {
    const result = await caller().statusPage.get({ slug: customDomain });
    expect(result?.id).toBe(pageId);
  });

  test("returns null for an unknown host", async () => {
    const result = await caller().statusPage.get({
      slug: `missing-${customDomain}`,
    });
    expect(result).toBeNull();
  });

  test("getLight and getUptime use the same matching", async () => {
    const light = await caller().statusPage.getLight({ slug: customDomain });
    expect(light).not.toBeNull();
    const uptime = await caller().statusPage.getUptime({
      slug: customDomain,
      pageComponentIds: [],
    });
    expect(uptime).toEqual([]);
  });
});
