import { db, eq } from "@openstatus/db";
import {
  auditLog,
  page as pageTable,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import {
  DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS,
  pruneUnverifiedDomains,
  type VercelClient,
  type VercelDomain,
} from "../index";

const TEST_PREFIX = "svc-domain-prune-test";
let testWs: ServiceContext["workspace"];

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  testWs = fixture.workspace;
});

afterAll(async () => {
  await db
    .delete(workspace)
    .where(eq(workspace.id, testWs.id))
    .catch(() => undefined);
});

function createMockVercelClient(opts: {
  domains?: VercelDomain[];
  verifyResult?: (domain: string) => VercelDomain;
  removeCalls?: string[];
  getDomainResult?: (domain: string) => VercelDomain | null;
}): { client: VercelClient; removed: string[]; verifiedCalled: string[] } {
  const removed: string[] = opts.removeCalls ?? [];
  const verifiedCalled: string[] = [];
  const domains = [...(opts.domains ?? [])];

  const client: VercelClient = {
    async listDomains() {
      return {
        domains,
        pagination: { count: domains.length, next: null, prev: null },
      };
    },
    async verifyDomain(domain: string) {
      verifiedCalled.push(domain);
      if (opts.verifyResult) {
        return opts.verifyResult(domain);
      }
      const found = domains.find((d) => d.name === domain);
      return (
        found ?? {
          name: domain,
          verified: false,
        }
      );
    },
    async removeDomain(domain: string) {
      removed.push(domain);
    },
    async getDomain(domain: string) {
      if (opts.getDomainResult) {
        return opts.getDomainResult(domain);
      }
      const found = domains.find((d) => d.name === domain);
      return found ?? null;
    },
  };

  return { client, removed, verifiedCalled };
}

describe("pruneUnverifiedDomains", () => {
  test("preserves verified domains", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-verified.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "Verified Page",
          slug: `${TEST_PREFIX}-slug-1`,
          description: "Testing verified domain",
          customDomain,
        })
        .returning()
        .get();

      const { client, removed } = createMockVercelClient({
        domains: [
          {
            name: customDomain,
            verified: true,
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          },
        ],
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
      });

      expect(res.totalChecked).toBe(1);
      expect(res.verifiedCount).toBe(1);
      expect(res.unverifiedCount).toBe(0);
      expect(removed.length).toBe(0);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe(customDomain);
    });
  });

  test("skips unverified domains within the grace period", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-recent.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "Recent Page",
          slug: `${TEST_PREFIX}-slug-2`,
          description: "Testing recent domain",
          customDomain,
        })
        .returning()
        .get();

      const { client, removed } = createMockVercelClient({
        domains: [
          {
            name: customDomain,
            verified: false,
            createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago (< 7 days)
          },
        ],
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
        olderThanMs: DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS,
      });

      expect(res.totalChecked).toBe(1);
      expect(res.unverifiedCount).toBe(1);
      expect(removed.length).toBe(0);
      expect(res.removedFromVercel.length).toBe(0);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe(customDomain);
    });
  });

  test("preserves unverified domains that verify on live check", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-live-verify.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "Live Verify Page",
          slug: `${TEST_PREFIX}-slug-3`,
          description: "Testing live verification",
          customDomain,
        })
        .returning()
        .get();

      const { client, removed, verifiedCalled } = createMockVercelClient({
        domains: [
          {
            name: customDomain,
            verified: false,
            createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
          },
        ],
        verifyResult: (domain) => ({
          name: domain,
          verified: true, // live verification succeeds!
        }),
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
      });

      expect(verifiedCalled).toContain(customDomain);
      expect(res.verifiedCount).toBe(1);
      expect(removed.length).toBe(0);
      expect(res.removedFromVercel.length).toBe(0);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe(customDomain);
    });
  });

  test("removes stale unverified domain from Vercel, clears DB entry, and logs audit", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-stale-unverified.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "Stale Page",
          slug: `${TEST_PREFIX}-slug-4`,
          description: "Testing stale domain removal",
          customDomain,
        })
        .returning()
        .get();

      const { client, removed } = createMockVercelClient({
        domains: [
          {
            name: customDomain,
            verified: false,
            createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 days ago
          },
        ],
        verifyResult: (domain) => ({
          name: domain,
          verified: false, // still unverified
        }),
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
      });

      expect(removed).toContain(customDomain);
      expect(res.removedFromVercel).toContain(customDomain);
      expect(res.clearedFromDb.some((r) => r.pageId === page.id)).toBe(true);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe("");

      await expectAuditRow({
        workspaceId: testWs.id,
        action: "page.update",
        entityId: page.id,
        entityType: "page",
        actorType: "system",
        db: tx,
      });
    });
  });

  test("dryRun mode reports candidates without deleting or clearing", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-dryrun.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "DryRun Page",
          slug: `${TEST_PREFIX}-slug-5`,
          description: "Testing dry run",
          customDomain,
        })
        .returning()
        .get();

      const { client, removed } = createMockVercelClient({
        domains: [
          {
            name: customDomain,
            verified: false,
            createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
          },
        ],
        verifyResult: (domain) => ({
          name: domain,
          verified: false,
        }),
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
        dryRun: true,
      });

      expect(removed.length).toBe(0);
      expect(res.removedFromVercel).toContain(customDomain);
      expect(res.clearedFromDb.some((r) => r.pageId === page.id)).toBe(true);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe(customDomain);
    });
  });

  test("reconciles orphaned domain in DB that does not exist on Vercel", async () => {
    await withTestTransaction(async (tx: DrizzleTx) => {
      const customDomain = `${TEST_PREFIX}-orphaned.example.com`;
      const page = await tx
        .insert(pageTable)
        .values({
          workspaceId: testWs.id,
          title: "Orphaned Domain Page",
          slug: `${TEST_PREFIX}-slug-6`,
          description: "Testing orphaned domain",
          customDomain,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // created 30 days ago
        })
        .returning()
        .get();

      const { client } = createMockVercelClient({
        domains: [], // No domains on Vercel
        getDomainResult: () => null, // 404 on Vercel
      });

      const res = await pruneUnverifiedDomains({
        db: tx,
        vercel: client,
      });

      expect(res.clearedFromDb.some((r) => r.pageId === page.id)).toBe(true);

      const dbPage = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, page.id))
        .get();
      expect(dbPage?.customDomain).toBe("");

      await expectAuditRow({
        workspaceId: testWs.id,
        action: "page.update",
        entityId: page.id,
        entityType: "page",
        actorType: "system",
        db: tx,
      });
    });
  });
});
