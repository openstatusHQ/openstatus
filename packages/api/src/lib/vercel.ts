import { and, db as defaultDb, ne, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { env } from "../env";

// Vercel domain helpers — transport-layer external integrations that
// don't belong in the service layer.
export async function vercelFetch(path: string, init?: RequestInit) {
  return fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function addDomainToVercel(domain: string) {
  const response = await vercelFetch(
    `/v9/projects/${env.PROJECT_ID_VERCEL}/domains?teamId=${env.TEAM_ID_VERCEL}`,
    {
      body: JSON.stringify({ name: domain }),
      method: "POST",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const code = error?.error?.code;
    console.error("Failed to add domain to Vercel:", { domain, error });
    throw toDomainError(domain, code);
  }

  return response.json();
}

// Vercel messages leak internal project details, so map known codes to our own copy.
function toDomainError(domain: string, code?: string): TRPCError {
  switch (code) {
    case "domain_already_in_use":
      return new TRPCError({
        code: "CONFLICT",
        message: `The domain '${domain}' is already in use by another status page. Remove it there first or contact support.`,
      });
    case "invalid_domain":
    case "not_found":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: `The domain '${domain}' is invalid.`,
      });
    case "forbidden":
    case "domain_taken":
      return new TRPCError({
        code: "FORBIDDEN",
        message: `The domain '${domain}' belongs to another team on our hosting provider. Contact support if you own it.`,
      });
    default:
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to add custom domain. Please try again. If it continues, contact support.",
      });
  }
}

// customDomain has no unique constraint, so another workspace's page may
// hold the same domain — detaching it from Vercel would take their status
// page down. Only remove once no page row (minus excludePageId) references it.
export async function removeDomainFromVercelIfUnused(
  db: typeof defaultDb,
  domain: string,
  opts?: { excludePageId?: number },
) {
  const holder = await db
    .select({ id: page.id })
    .from(page)
    .where(
      and(
        sql`lower(${page.customDomain}) = ${domain.toLowerCase()}`,
        opts?.excludePageId !== undefined
          ? ne(page.id, opts.excludePageId)
          : undefined,
      ),
    )
    .get();

  if (holder) {
    console.warn("Skipping Vercel domain removal, still in use:", {
      domain,
      pageId: holder.id,
    });
    return null;
  }

  return removeDomainFromVercel(domain);
}

export async function removeDomainFromVercel(domain: string) {
  const response = await vercelFetch(
    `/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${encodeURIComponent(domain)}?teamId=${env.TEAM_ID_VERCEL}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Failed to remove domain from Vercel:", { domain, error });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to remove custom domain. Please try again. If it continues, contact support.",
    });
  }

  return response.json();
}
