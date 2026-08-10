import { and, db as defaultDb, ne, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import {
  ConflictError,
  ForbiddenError,
  InternalServiceError,
  PreconditionFailedError,
  ServiceError,
  ValidationError,
} from "../errors";

export type VercelDomainVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type VercelDomain = {
  name: string;
  apexName?: string;
  projectId?: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  updatedAt?: number;
  createdAt?: number;
  verified: boolean;
  verification?: VercelDomainVerification[];
};

export type VercelPagination = {
  count: number;
  next: number | null;
  prev: number | null;
};

export type ListDomainsResult = {
  domains: VercelDomain[];
  pagination: VercelPagination;
};

export type VercelClient = {
  isConfigured?(): boolean;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  listDomains(options?: {
    limit?: number;
    since?: number;
    until?: number;
  }): Promise<ListDomainsResult>;
  verifyDomain(domain: string): Promise<VercelDomain>;
  addDomain(domain: string): Promise<VercelDomain>;
  removeDomain(domain: string): Promise<void>;
  removeDomainIfUnused(
    db?: DB,
    domain?: string,
    opts?: { excludePageId?: number },
  ): Promise<void | null>;
  getDomain(domain: string): Promise<VercelDomain | null>;
  getConfig(domain: string): Promise<unknown>;
};

export type CreateVercelClientOptions = {
  projectId?: string;
  teamId?: string;
  bearerToken?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

export function isVercelConfigured(
  options?: CreateVercelClientOptions,
): boolean {
  const projectId = options?.projectId ?? process.env.PROJECT_ID_VERCEL;
  const bearerToken =
    options?.bearerToken ?? process.env.VERCEL_AUTH_BEARER_TOKEN;
  return Boolean(projectId && bearerToken);
}

// Vercel messages leak internal project details, so map known codes to ServiceErrors.
export function toDomainError(domain: string, code?: string): ServiceError {
  switch (code) {
    case "domain_already_in_use":
      return new ConflictError(
        `The domain '${domain}' is already in use by another status page. Remove it there first or contact support.`,
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
      return new InternalServiceError(
        "Failed to add custom domain. Please try again. If it continues, contact support.",
      );
  }
}

export function createVercelClient(
  options?: CreateVercelClientOptions,
): VercelClient {
  const projectId = options?.projectId ?? process.env.PROJECT_ID_VERCEL ?? "";
  const teamId = options?.teamId ?? process.env.TEAM_ID_VERCEL ?? "";
  const bearerToken =
    options?.bearerToken ?? process.env.VERCEL_AUTH_BEARER_TOKEN ?? "";
  const baseUrl = options?.baseUrl ?? "https://api.vercel.com";
  const customFetch = options?.fetchFn ?? fetch;

  function ensureConfigured() {
    if (!projectId || !bearerToken) {
      throw new PreconditionFailedError(
        "Vercel integration is not configured on this instance",
      );
    }
  }

  async function rawVercelFetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    ensureConfigured();
    // If path already has teamId query param or baseUrl is full, handle cleanly
    let url: string;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      url = path;
    } else {
      const separator = path.includes("?") ? "&" : "?";
      const teamParam =
        teamId && !path.includes("teamId=")
          ? `${separator}teamId=${encodeURIComponent(teamId)}`
          : "";
      url = `${baseUrl}${path}${teamParam}`;
    }

    return customFetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  const client: VercelClient = {
    isConfigured() {
      return Boolean(projectId && bearerToken);
    },

    async fetch(path: string, init?: RequestInit): Promise<Response> {
      return rawVercelFetch(path, init);
    },

    async listDomains(opts?: {
      limit?: number;
      since?: number;
      until?: number;
    }): Promise<ListDomainsResult> {
      const params = new URLSearchParams();
      if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
      if (opts?.since !== undefined) params.set("since", String(opts.since));
      if (opts?.until !== undefined) params.set("until", String(opts.until));

      const query = params.toString();
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains${query ? `?${query}` : ""}`;

      const res = await rawVercelFetch(path);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to list domains from Vercel: ${JSON.stringify(error)}`,
        );
      }

      const json = await res.json();
      return {
        domains: (json.domains ?? []) as VercelDomain[],
        pagination: (json.pagination ?? {
          count: 0,
          next: null,
          prev: null,
        }) as VercelPagination,
      };
    },

    async addDomain(domain: string): Promise<VercelDomain> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains`;
      const res = await rawVercelFetch(path, {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const code = error?.error?.code;
        console.error("Failed to add domain to Vercel:", { domain, error });
        throw toDomainError(domain, code);
      }

      return (await res.json()) as VercelDomain;
    },

    async verifyDomain(domain: string): Promise<VercelDomain> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`;
      const res = await rawVercelFetch(path, { method: "POST" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to verify domain ${domain} on Vercel: ${JSON.stringify(error)}`,
        );
      }
      return (await res.json()) as VercelDomain;
    },

    async removeDomain(domain: string): Promise<void> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`;
      const res = await rawVercelFetch(path, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const error = await res.json().catch(() => ({}));
        console.error("Failed to remove domain from Vercel:", { domain, error });
        throw new InternalServiceError(
          "Failed to remove custom domain. Please try again. If it continues, contact support.",
          error,
        );
      }
    },

    async removeDomainIfUnused(
      database?: DB,
      domain?: string,
      opts?: { excludePageId?: number },
    ): Promise<void | null> {
      if (!domain) return null;
      const targetDb = database ?? defaultDb;
      const holder = await targetDb
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

      return client.removeDomain(domain);
    },

    async getDomain(domain: string): Promise<VercelDomain | null> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`;
      const res = await rawVercelFetch(path);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to get domain ${domain} from Vercel: ${JSON.stringify(error)}`,
        );
      }
      return (await res.json()) as VercelDomain;
    },

    async getConfig(domain: string): Promise<unknown> {
      const path = `/v6/domains/${encodeURIComponent(domain)}/config`;
      const res = await rawVercelFetch(path);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to get domain config for ${domain} from Vercel: ${JSON.stringify(error)}`,
        );
      }
      return await res.json();
    },
  };

  return client;
}

// Standalone convenience helpers matching the unified interface
export async function vercelFetch(
  path: string,
  init?: RequestInit,
  client?: VercelClient,
): Promise<Response> {
  const c = client ?? createVercelClient();
  return c.fetch(path, init);
}

export async function addDomainToVercel(
  domain: string,
  client?: VercelClient,
): Promise<VercelDomain> {
  const c = client ?? createVercelClient();
  return c.addDomain(domain);
}

export async function removeDomainFromVercel(
  domain: string,
  client?: VercelClient,
): Promise<void> {
  const c = client ?? createVercelClient();
  return c.removeDomain(domain);
}

export async function removeDomainFromVercelIfUnused(
  db: DB,
  domain: string,
  opts?: { excludePageId?: number },
  client?: VercelClient,
): Promise<void | null> {
  const c = client ?? createVercelClient();
  return c.removeDomainIfUnused(db, domain, opts);
}
