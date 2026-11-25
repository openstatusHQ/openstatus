import { and, db as defaultDb, eq, or, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import type { DB } from "../context";

const BASE_DOMAIN_SUFFIX = ".openstatus.dev";

export interface ResolvedPage {
  id: number;
  title: string;
  slug: string;
  customDomain: string | null;
}

/** Slug and custom domain of a page in any workspace, to build its public URL. */
export async function getPagePublicDomain(
  pageId: number,
  opts: { db?: DB } = {},
): Promise<{ slug: string; customDomain: string } | undefined> {
  const db = opts.db ?? defaultDb;
  return db
    .select({ slug: page.slug, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.id, pageId))
    .get();
}

/** The page's title, or `null` when the id is not a page of that workspace. */
export async function getPageTitleInWorkspace(
  args: { workspaceId: number; pageId: number },
  db: DB = defaultDb,
): Promise<string | null> {
  const row = await db
    .select({ title: page.title })
    .from(page)
    .where(
      and(eq(page.workspaceId, args.workspaceId), eq(page.id, args.pageId)),
    )
    .get();
  return row?.title ?? null;
}

function hostFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolve a public status-page URL (or bare host) to its page. Cross-workspace
 * by design — Slack subscriptions are public self-signup, like email.
 */
export async function resolvePageFromUrl(
  raw: string,
  opts: { db?: DB } = {},
): Promise<ResolvedPage | null> {
  const db = opts.db ?? defaultDb;
  const host = hostFromInput(raw);
  if (!host) return null;

  const columns = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    customDomain: page.customDomain,
  };

  if (host.endsWith(BASE_DOMAIN_SUFFIX)) {
    const slug = host.slice(0, -BASE_DOMAIN_SUFFIX.length);
    if (!slug || slug.includes(".")) return null;
    const row = await db
      .select(columns)
      .from(page)
      .where(eq(page.slug, slug))
      .get();
    return row ?? null;
  }

  const bareHost = host.startsWith("www.") ? host.slice(4) : host;
  const row = await db
    .select(columns)
    .from(page)
    .where(
      or(
        sql`LOWER(${page.customDomain}) = ${host}`,
        sql`LOWER(${page.customDomain}) = ${bareHost}`,
      ),
    )
    .get();
  return row ?? null;
}
