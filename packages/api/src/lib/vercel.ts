import { and, db as defaultDb, ne, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "../env";
import { hasTrustedCertificate } from "./tls";

// Vercel domain helpers — transport-layer external integrations that
// don't belong in the service layer.
const VERCEL_API_ORIGIN = "https://api.vercel.com";

export async function vercelFetch(path: string, init?: RequestInit) {
  // URL parsing resolves `..` segments and `#` cuts the query — refuse any
  // path that doesn't survive normalization unchanged.
  const url = new URL(path, VERCEL_API_ORIGIN);
  if (
    url.origin !== VERCEL_API_ORIGIN ||
    url.hash ||
    `${url.pathname}${url.search}` !== path
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid path." });
  }

  return fetch(url, {
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

export const domainConfigResponseSchema = z.object({
  configuredBy: z
    .union([z.literal("CNAME"), z.literal("A"), z.literal("http")])
    .optional()
    .nullable(),
  acceptedChallenges: z
    .array(z.union([z.literal("dns-01"), z.literal("http-01")]))
    .optional()
    .nullable(),
  misconfigured: z.boolean().prefault(true).optional(),
});

export async function fetchDomainConfig(domain: string) {
  const data = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config?teamId=${env.TEAM_ID_VERCEL}`,
  );
  if (!data.ok) {
    const error = await data.json().catch(() => ({}));
    console.error("Failed to fetch domain config from Vercel:", {
      domain,
      error,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to check the domain configuration. Please try again later.",
    });
  }
  const json = await data.json();
  return domainConfigResponseSchema.parse(json);
}

// Only probe hosts Vercel confirms point at us, so the TLS handshake never
// targets an arbitrary customer-controlled address.
export async function getCertificateReadiness(domain: string) {
  const config = await fetchDomainConfig(domain);
  if (config.misconfigured !== false)
    return { configured: false, ready: false };
  return { configured: true, ready: await hasTrustedCertificate(domain) };
}

// Vercel retries certificate orders on its own backoff, which can leave a
// correctly configured domain on "Generating SSL" for a long time.
export async function issueCertificateOnVercel(domain: string) {
  const response = await vercelFetch(`/v8/certs?teamId=${env.TEAM_ID_VERCEL}`, {
    body: JSON.stringify({ cns: [domain] }),
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Failed to issue certificate on Vercel:", { domain, error });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to issue the SSL certificate. Please try again later. If it continues, contact support.",
    });
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
