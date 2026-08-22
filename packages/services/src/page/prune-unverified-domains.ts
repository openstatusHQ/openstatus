import { and, db as defaultDb, eq, ne, sql } from "@openstatus/db";
import {
  page,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import {
  createVercelClient,
  isVercelConfigured,
  type VercelClient,
  type VercelDomain,
} from "./vercel";

export const DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS =
  7 * 24 * 60 * 60 * 1000; // 7 days

export type PruneUnverifiedDomainsOptions = {
  db?: DB;
  vercel?: VercelClient;
  olderThanMs?: number;
  dryRun?: boolean;
  now?: Date;
};

export type ClearedPageRecord = {
  pageId: number;
  workspaceId: number;
  domain: string;
};

export type PruneUnverifiedDomainsResult = {
  totalChecked: number;
  verifiedCount: number;
  unverifiedCount: number;
  removedFromVercel: string[];
  clearedFromDb: ClearedPageRecord[];
  errors: Array<{ domain: string; error: string }>;
};

/**
 * Identify and remove unverified domains from Vercel settings and status page DB entries.
 *
 * Steps:
 * 1. Fetches all domains from Vercel using pagination.
 * 2. Filters for domains where `verified === false` and `createdAt` is older than `olderThanMs`.
 * 3. Attempts live verification on Vercel before deletion to catch recent DNS updates.
 * 4. Removes confirmed unverified domains from Vercel project settings.
 * 5. Clears `customDomain = ""` on matching status pages and emits `page.update` audit logs.
 * 6. Reconciles DB custom domains that no longer exist on Vercel.
 */
export async function pruneUnverifiedDomains(
  opts: PruneUnverifiedDomainsOptions = {},
): Promise<PruneUnverifiedDomainsResult> {
  const database = opts.db ?? defaultDb;
  const vercel = opts.vercel ?? createVercelClient();
  const olderThanMs =
    opts.olderThanMs ?? DEFAULT_UNVERIFIED_DOMAINS_GRACE_PERIOD_MS;
  const now = opts.now ?? new Date();
  const thresholdTime = now.getTime() - olderThanMs;
  const dryRun = Boolean(opts.dryRun);

  const result: PruneUnverifiedDomainsResult = {
    totalChecked: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    removedFromVercel: [],
    clearedFromDb: [],
    errors: [],
  };

  // Safely skip if Vercel is unconfigured (e.g. self-hosted instance without Vercel secrets)
  if (vercel.isConfigured && !vercel.isConfigured()) {
    return result;
  }
  if (!opts.vercel && !isVercelConfigured()) {
    return result;
  }

  // 1. Fetch all domains from Vercel via pagination
  const allVercelDomains: VercelDomain[] = [];
  let untilCursor: number | undefined = undefined;

  try {
    do {
      const pageResult = await vercel.listDomains({
        limit: 100,
        until: untilCursor,
      });
      allVercelDomains.push(...pageResult.domains);
      untilCursor = pageResult.pagination.next ?? undefined;
    } while (untilCursor);
  } catch (err) {
    result.errors.push({
      domain: "*",
      error: `Failed to list domains from Vercel: ${err instanceof Error ? err.message : String(err)}`,
    });
    return result;
  }

  result.totalChecked = allVercelDomains.length;

  // 2. Evaluate each Vercel domain
  for (const vDomain of allVercelDomains) {
    if (vDomain.verified) {
      result.verifiedCount++;
      continue;
    }

    result.unverifiedCount++;

    // If createdAt is missing or invalid, treat age as unknown and skip to preserve grace-period safety
    if (
      vDomain.createdAt === undefined ||
      vDomain.createdAt === null ||
      typeof vDomain.createdAt !== "number" ||
      !Number.isFinite(vDomain.createdAt)
    ) {
      continue;
    }

    // Skip unverified domains that are still within the grace period
    if (vDomain.createdAt > thresholdTime) {
      continue;
    }

    // Attempt live re-verification check
    try {
      const verifyRes = await vercel.verifyDomain(vDomain.name);
      if (verifyRes.verified) {
        result.verifiedCount++;
        continue;
      }
    } catch (err) {
      // Transient or network error during verification check - do NOT assume unverified and do not delete
      result.errors.push({
        domain: vDomain.name,
        error: `Verification check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // Confirmed unverified and past grace period -> remove
    if (!dryRun) {
      try {
        await vercel.removeDomain(vDomain.name);
        result.removedFromVercel.push(vDomain.name);
        // Gate DB cleanup on successful Vercel removal to prevent desynchronization
        await clearDbPagesForDomain(
          database,
          vDomain.name,
          result.clearedFromDb,
        );
      } catch (err) {
        result.errors.push({
          domain: vDomain.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      result.removedFromVercel.push(vDomain.name);
      const matchingPages = await getMatchingPagesByDomain(
        database,
        vDomain.name,
      );

      for (const p of matchingPages) {
        result.clearedFromDb.push({
          pageId: p.id,
          workspaceId: p.workspaceId,
          domain: vDomain.name,
        });
      }
    }
  }

  // 3. Reconcile DB custom domains that do not exist on Vercel
  const vercelDomainNames = new Set(
    allVercelDomains.map((d) => d.name.toLowerCase()),
  );

  const dbPages = await database
    .select({
      id: page.id,
      workspaceId: page.workspaceId,
      customDomain: page.customDomain,
      createdAt: page.createdAt,
    })
    .from(page)
    .where(
      and(ne(page.customDomain, ""), sql`${page.customDomain} IS NOT NULL`),
    )
    .all();

  for (const pageRow of dbPages) {
    if (!pageRow.customDomain) continue;
    const domainLower = pageRow.customDomain.toLowerCase();
    if (vercelDomainNames.has(domainLower)) continue;

    const pageCreatedAt = pageRow.createdAt?.getTime();
    if (!pageCreatedAt || !Number.isFinite(pageCreatedAt)) continue;
    if (pageCreatedAt > thresholdTime) continue;

    try {
      const vDomain = await vercel.getDomain(pageRow.customDomain);
      if (vDomain === null) {
        if (!dryRun) {
          await clearDbPageById(
            database,
            pageRow.id,
            pageRow.workspaceId,
            pageRow.customDomain,
            result.clearedFromDb,
          );
        } else {
          result.clearedFromDb.push({
            pageId: pageRow.id,
            workspaceId: pageRow.workspaceId,
            domain: pageRow.customDomain,
          });
        }
      }
    } catch {
      // Ignore individual lookup errors
    }
  }

  return result;
}

async function getMatchingPagesByDomain(database: DB, domain: string) {
  return database
    .select({
      id: page.id,
      workspaceId: page.workspaceId,
    })
    .from(page)
    .where(sql`lower(${page.customDomain}) = ${domain.toLowerCase()}`)
    .all();
}

async function clearDbPagesForDomain(
  database: DB,
  domain: string,
  clearedList: ClearedPageRecord[],
) {
  const matchingPages = await getMatchingPagesByDomain(database, domain);

  for (const pageRow of matchingPages) {
    await clearDbPageById(
      database,
      pageRow.id,
      pageRow.workspaceId,
      domain,
      clearedList,
    );
  }
}

async function clearDbPageById(
  database: DB,
  pageId: number,
  workspaceId: number,
  domain: string,
  clearedList: ClearedPageRecord[],
) {
  const wsRow = await database
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .get();

  if (!wsRow) return;

  const ws = selectWorkspaceSchema.parse(wsRow);
  const sysCtx: ServiceContext = {
    workspace: ws,
    actor: { type: "system", job: "prune-unverified-domains" },
    db: database,
  };

  await withTransaction(sysCtx, async (tx) => {
    const existing = await tx
      .select()
      .from(page)
      .where(eq(page.id, pageId))
      .get();

    if (!existing || !existing.customDomain) return;

    const updated = await tx
      .update(page)
      .set({ customDomain: "", updatedAt: new Date() })
      .where(eq(page.id, pageId))
      .returning()
      .get();

    await emitAudit(tx, sysCtx, {
      action: "page.update",
      entityType: "page",
      entityId: pageId,
      before: existing,
      after: updated,
    });
  });

  clearedList.push({
    pageId,
    workspaceId,
    domain,
  });
}
