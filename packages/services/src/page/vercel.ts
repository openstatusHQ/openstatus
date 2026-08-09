import { InternalServiceError, PreconditionFailedError } from "../errors";

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
  listDomains(options?: {
    limit?: number;
    since?: number;
    until?: number;
  }): Promise<ListDomainsResult>;
  verifyDomain(domain: string): Promise<VercelDomain>;
  removeDomain(domain: string): Promise<void>;
  getDomain(domain: string): Promise<VercelDomain | null>;
};

export type CreateVercelClientOptions = {
  projectId?: string;
  teamId?: string;
  bearerToken?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

export function isVercelConfigured(options?: CreateVercelClientOptions): boolean {
  const projectId = options?.projectId ?? process.env.PROJECT_ID_VERCEL;
  const bearerToken =
    options?.bearerToken ?? process.env.VERCEL_AUTH_BEARER_TOKEN;
  return Boolean(projectId && bearerToken);
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

  async function vercelFetch(path: string, init?: RequestInit): Promise<Response> {
    ensureConfigured();
    const separator = path.includes("?") ? "&" : "?";
    const teamParam = teamId ? `${separator}teamId=${encodeURIComponent(teamId)}` : "";
    const url = `${baseUrl}${path}${teamParam}`;

    return customFetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  return {
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

      const res = await vercelFetch(path);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to list domains from Vercel: ${JSON.stringify(error)}`,
        );
      }

      const json = await res.json();
      return {
        domains: (json.domains ?? []) as VercelDomain[],
        pagination: (json.pagination ?? { count: 0, next: null, prev: null }) as VercelPagination,
      };
    },

    async verifyDomain(domain: string): Promise<VercelDomain> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`;
      const res = await vercelFetch(path, { method: "POST" });
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
      const res = await vercelFetch(path, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const error = await res.json().catch(() => ({}));
        throw new InternalServiceError(
          `Failed to remove domain ${domain} from Vercel: ${JSON.stringify(error)}`,
        );
      }
    },

    async getDomain(domain: string): Promise<VercelDomain | null> {
      const path = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`;
      const res = await vercelFetch(path);
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
  };
}
