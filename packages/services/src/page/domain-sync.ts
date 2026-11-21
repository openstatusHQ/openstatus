import { db as defaultDb, ne, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { wwwCounterpart } from "@openstatus/utils";
import { z } from "zod";

import type { DB, ServiceContext } from "../context";
import {
  ConflictError,
  ForbiddenError,
  InternalServiceError,
  ServiceError,
  ValidationError,
} from "../errors";
import { findDomainHolder } from "./internal";

const VERCEL_API_ORIGIN = "https://api.vercel.com";
const TIMEOUT_MS = 5_000;

export type VercelDomainConfig = {
  projectId: string;
  teamId: string;
  token: string;
};

/** `null` on self-host, where every sync call is a no-op. */
export function vercelConfigFromEnv(): VercelDomainConfig | null {
  const projectId = process.env.PROJECT_ID_VERCEL;
  const teamId = process.env.TEAM_ID_VERCEL;
  const token = process.env.VERCEL_AUTH_BEARER_TOKEN;
  if (projectId && teamId && token) return { projectId, teamId, token };
  // Without this a deploy missing the secrets is indistinguishable from self-host.
  if (
    process.env.NODE_ENV === "production" &&
    !z.stringbool().catch(false).parse(process.env.SELF_HOST)
  ) {
    console.error(
      "Vercel domain sync is off: set PROJECT_ID_VERCEL, TEAM_ID_VERCEL and VERCEL_AUTH_BEARER_TOKEN.",
    );
  }
  return null;
}

export function resolveVercelConfig(
  ctx: Pick<ServiceContext, "vercel">,
): VercelDomainConfig | null {
  return ctx.vercel !== undefined ? ctx.vercel : vercelConfigFromEnv();
}

export async function vercelFetch(
  token: string | undefined,
  path: string,
  init?: RequestInit,
) {
  // URL parsing resolves `..` segments and `#` cuts the query — refuse any
  // path that doesn't survive normalization unchanged.
  const url = new URL(path, VERCEL_API_ORIGIN);
  if (
    url.origin !== VERCEL_API_ORIGIN ||
    url.hash ||
    `${url.pathname}${url.search}` !== path
  ) {
    throw new ValidationError("Invalid path.");
  }

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function syncFetch(
  config: VercelDomainConfig,
  path: string,
  init: RequestInit & { failure: string },
) {
  const { failure, ...rest } = init;
  try {
    return await vercelFetch(config.token, path, {
      ...rest,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    console.warn("Vercel request failed:", { path, error: err });
    throw new InternalServiceError(failure, err);
  }
}

function projectDomainPath(config: VercelDomainConfig, domain: string) {
  return `/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}?teamId=${config.teamId}`;
}

const ADD_FAILED =
  "Failed to add custom domain. Please try again. If it continues, contact support.";
const REMOVE_FAILED =
  "Failed to remove custom domain. Please try again. If it continues, contact support.";
const READ_FAILED =
  "Failed to check custom domain. Please try again. If it continues, contact support.";

export type ProjectDomain = {
  name: string;
  apexName?: string;
  redirect?: string | null;
  gitBranch?: string | null;
  verified?: boolean;
};

export async function getProjectDomain(
  config: VercelDomainConfig,
  domain: string,
): Promise<ProjectDomain | null> {
  const response = await syncFetch(config, projectDomainPath(config, domain), {
    failure: READ_FAILED,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.warn("Failed to read domain from Vercel:", { domain, error });
    throw new InternalServiceError(READ_FAILED, error);
  }
  return response.json();
}

function projectDomainsPath(config: VercelDomainConfig) {
  return `/v9/projects/${config.projectId}/domains?teamId=${config.teamId}`;
}

async function patchRedirect(
  config: VercelDomainConfig,
  domain: string,
  redirect: string | null,
) {
  const response = await syncFetch(config, projectDomainPath(config, domain), {
    method: "PATCH",
    body: JSON.stringify({
      redirect,
      redirectStatusCode: redirect ? 308 : null,
    }),
    failure: ADD_FAILED,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.warn("Failed to update domain redirect on Vercel:", {
      domain,
      error,
    });
    throw new InternalServiceError(ADD_FAILED, error);
  }
}

/**
 * Idempotent: a domain already attached to the project counts as success. A
 * page's domain must serve the page, so an existing redirect on it is cleared.
 */
export async function attachDomain(
  config: VercelDomainConfig | null,
  domain: string,
): Promise<ProjectDomain | null> {
  if (!config) return null;
  const response = await syncFetch(config, projectDomainsPath(config), {
    method: "POST",
    body: JSON.stringify({ name: domain }),
    failure: ADD_FAILED,
  });
  if (response.ok) return response.json();

  const error = await response.json().catch(() => ({}));
  const existing = await getProjectDomain(config, domain);
  if (existing) {
    if (existing.redirect) {
      await patchRedirect(config, domain, null);
      return { ...existing, redirect: null };
    }
    return existing;
  }
  console.warn("Failed to add domain to Vercel:", { domain, error });
  throw toDomainError(domain, error?.error?.code);
}

/** Idempotent: a 404 counts as detached. */
export async function detachDomain(
  config: VercelDomainConfig | null,
  domain: string,
): Promise<void> {
  if (!config) return;
  const response = await syncFetch(config, projectDomainPath(config, domain), {
    method: "DELETE",
    failure: REMOVE_FAILED,
  });
  if (response.ok || response.status === 404) return;

  const error = await response.json().catch(() => ({}));
  console.warn("Failed to remove domain from Vercel:", { domain, error });
  throw new InternalServiceError(REMOVE_FAILED);
}

/**
 * Vercel serves only the exact hosts attached, so an apex page answers on `www.`
 * through a companion redirecting to it. A companion another page holds, or one
 * configured by hand, is left alone.
 */
export async function attachWwwCompanion(args: {
  db: DB;
  config: VercelDomainConfig | null;
  domain: ProjectDomain;
}): Promise<void> {
  const { config } = args;
  if (!config) return;
  const domain = args.domain.name.toLowerCase();
  const apex = args.domain.apexName?.toLowerCase();
  if (!apex || domain !== apex) return;
  const companion = `www.${apex}`;
  if (await findDomainHolder({ db: args.db, domain: companion })) return;

  const existing = await getProjectDomain(config, companion);
  if (existing) {
    if (existing.redirect || existing.gitBranch) return;
    await patchRedirect(config, companion, domain);
    return;
  }

  const response = await syncFetch(config, projectDomainsPath(config), {
    method: "POST",
    body: JSON.stringify({
      name: companion,
      redirect: domain,
      redirectStatusCode: 308,
    }),
    failure: ADD_FAILED,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.warn("Failed to add www companion to Vercel:", {
      domain: companion,
      error,
    });
    throw new InternalServiceError(ADD_FAILED, error);
  }
}

async function detachWwwCompanion(config: VercelDomainConfig, domain: string) {
  const companion = wwwCounterpart(domain);
  if (!companion) return;
  const existing = await getProjectDomain(config, companion);
  if (existing?.redirect?.toLowerCase() !== domain.toLowerCase()) return;
  await detachDomain(config, companion);
}

// customDomain has no unique constraint, so another workspace's page may
// hold the same domain — detaching it would take their status page down.
// A held www counterpart keeps it too: it is that page's companion.
// Concurrent deletes of the last two holders can both skip; reconcile catches it.
// Returns whether the domain was detached.
export async function detachDomainIfUnused(args: {
  db?: DB;
  domain: string;
  excludePageId?: number;
  config?: VercelDomainConfig | null;
}): Promise<boolean> {
  const config = resolveVercelConfig({ vercel: args.config });
  if (!config) return false;

  const db = args.db ?? defaultDb;
  const counterpart = wwwCounterpart(args.domain);
  const holder =
    (await findDomainHolder({
      db,
      domain: args.domain,
      excludePageId: args.excludePageId,
    })) ??
    (counterpart
      ? await findDomainHolder({ db, domain: counterpart })
      : undefined);
  if (holder) {
    console.warn("Skipping Vercel domain removal, still in use:", {
      domain: args.domain,
      pageId: holder.id,
    });
    return false;
  }

  // Companion first: it redirects to the domain, so it must not outlive it.
  await detachWwwCompanion(config, args.domain).catch((err) =>
    console.warn("Failed to detach www companion:", {
      domain: args.domain,
      error: err,
    }),
  );
  await detachDomain(config, args.domain);
  return true;
}

export async function listProjectDomains(
  config: VercelDomainConfig,
): Promise<ProjectDomain[]> {
  const domains: ProjectDomain[] = [];
  let until: number | null = null;
  do {
    const path = `/v9/projects/${config.projectId}/domains?teamId=${config.teamId}&limit=100${until ? `&until=${until}` : ""}`;
    const response = await syncFetch(config, path, {
      failure: "Failed to list project domains.",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new InternalServiceError(
        `Failed to list project domains (${response.status}).`,
        error,
      );
    }
    const json: {
      domains: ProjectDomain[];
      pagination?: { next: number | null };
    } = await response.json();
    domains.push(...json.domains);
    until = json.pagination?.next ?? null;
  } while (until);
  return domains;
}

// Vercel messages leak internal project details, so map known codes to our own copy.
function toDomainError(domain: string, code?: string): ServiceError {
  switch (code) {
    case "domain_already_in_use":
      return new ConflictError(
        `The domain '${domain}' is already in use. Remove it there first or contact support.`,
      );
    case "invalid_domain":
    case "not_found":
      return new ValidationError(`The domain '${domain}' is invalid.`);
    case "forbidden":
    case "domain_taken":
      return new ForbiddenError(
        `The domain '${domain}' belongs to another team on our hosting provider. Contact support if you own it.`,
      );
    default:
      return new InternalServiceError(ADD_FAILED);
  }
}

const OWN_APEXES = ["openstatus.dev", "stpg.dev", "vercel.app"];

function isOwnDomain(d: ProjectDomain) {
  const name = d.name.toLowerCase();
  return (
    OWN_APEXES.some((apex) => name === apex || name.endsWith(`.${apex}`)) ||
    !!d.redirect ||
    !!d.gitBranch
  );
}

/**
 * Orphans are attached on Vercel but held by no page; missing are held by a
 * page but not attached. `apply` detaches orphans; missing stays report-only
 * because an attach can legitimately fail (domain owned by another team).
 */
export async function reconcileProjectDomains(args: {
  db: DB;
  config: VercelDomainConfig;
  apply?: boolean;
}): Promise<{ orphans: string[]; missing: string[]; detached: string[] }> {
  const domains = await listProjectDomains(args.config);

  const rows = await args.db
    .selectDistinct({ domain: sql<string>`lower(${page.customDomain})` })
    .from(page)
    .where(ne(page.customDomain, ""))
    .all();
  const held = new Set(rows.map((r) => r.domain));
  const attachedSet = new Set(
    domains.filter((d) => !d.gitBranch).map((d) => d.name.toLowerCase()),
  );
  // A held apex redirecting to www is served by that target, which no row can hold.
  const redirectTargets = new Set(
    domains.flatMap((d) =>
      d.redirect && held.has(d.name.toLowerCase())
        ? [d.redirect.toLowerCase()]
        : [],
    ),
  );

  const isHeldCompanion = (d: string) => {
    const counterpart = wwwCounterpart(d);
    return !!counterpart && held.has(counterpart);
  };

  const orphans = domains
    .filter((d) => !isOwnDomain(d))
    .map((d) => d.name.toLowerCase())
    .filter(
      (d) => !held.has(d) && !redirectTargets.has(d) && !isHeldCompanion(d),
    )
    .sort();
  const missing = [...held].filter((d) => !attachedSet.has(d)).sort();

  const detached: string[] = [];
  if (args.apply) {
    for (const domain of orphans) {
      try {
        // Re-check: a concurrent set attaches on Vercel before writing the row.
        if (
          await detachDomainIfUnused({
            db: args.db,
            domain,
            config: args.config,
          })
        ) {
          detached.push(domain);
        }
      } catch (err) {
        console.warn("Failed to detach orphaned domain:", {
          domain,
          error: err,
        });
      }
    }
  }

  return { orphans, missing, detached };
}
