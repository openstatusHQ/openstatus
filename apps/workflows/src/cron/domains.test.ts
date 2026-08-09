import { db, eq } from "@openstatus/db";
import {
  page as pageTable,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import type { VercelClient, VercelDomain } from "@openstatus/services/page";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "@openstatus/test-utils";

import { runDomainsPruneTick } from "./domains";

const TEST_PREFIX = "wf-domains-test";
let testWorkspaceId: number;

beforeAll(async () => {
  const { workspace: ws } = await createTestWorkspace({
    name: `${TEST_PREFIX}-ws`,
  });
  testWorkspaceId = ws.id;
});

afterAll(async () => {
  await db
    .delete(workspace)
    .where(eq(workspace.id, testWorkspaceId))
    .catch(() => undefined);
});

describe("runDomainsPruneTick", () => {
  test("processes domains via mock Vercel client and updates DB", async () => {
    const customDomain = `${TEST_PREFIX}-expired.example.com`;

    const page = await db
      .insert(pageTable)
      .values({
        workspaceId: testWorkspaceId,
        title: "Test Page",
        slug: `${TEST_PREFIX}-slug-1`,
        description: "Test page",
        customDomain,
      })
      .returning()
      .get();

    const removedDomains: string[] = [];
    const mockVercel: VercelClient = {
      async listDomains() {
        return {
          domains: [
            {
              name: customDomain,
              verified: false,
              createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
            },
          ],
          pagination: { count: 1, next: null, prev: null },
        };
      },
      async verifyDomain(domain: string) {
        return {
          name: domain,
          verified: false,
        };
      },
      async removeDomain(domain: string) {
        removedDomains.push(domain);
      },
      async getDomain(domain: string) {
        return null;
      },
    };

    const res = await runDomainsPruneTick({
      vercel: mockVercel,
    });

    expect(res.totalChecked).toBe(1);
    expect(res.unverifiedCount).toBe(1);
    expect(removedDomains).toContain(customDomain);
    expect(res.removedFromVercel).toContain(customDomain);

    const updatedPage = await db
      .select()
      .from(pageTable)
      .where(eq(pageTable.id, page.id))
      .get();

    expect(updatedPage?.customDomain).toBe("");

    await db
      .delete(pageTable)
      .where(eq(pageTable.id, page.id))
      .catch(() => undefined);
  });
});
