import { db, eq, or, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

const BASE_DOMAIN_SUFFIX = ".openstatus.dev";

export interface ResolvedPage {
  id: number;
  title: string;
  slug: string;
  customDomain: string | null;
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
): Promise<ResolvedPage | null> {
  const host = hostFromInput(raw);
  if (!host) return null;

  if (host.endsWith(BASE_DOMAIN_SUFFIX)) {
    const slug = host.slice(0, -BASE_DOMAIN_SUFFIX.length);
    if (!slug || slug.includes(".")) return null;
    const row = await db
      .select({
        id: page.id,
        title: page.title,
        slug: page.slug,
        customDomain: page.customDomain,
      })
      .from(page)
      .where(eq(page.slug, slug))
      .get();
    return row ?? null;
  }

  const bareHost = host.startsWith("www.") ? host.slice(4) : host;
  const row = await db
    .select({
      id: page.id,
      title: page.title,
      slug: page.slug,
      customDomain: page.customDomain,
    })
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
