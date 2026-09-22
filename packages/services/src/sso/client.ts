import { WorkOS } from "@workos-inc/node";

import { PreconditionFailedError } from "../errors";

export type WorkOSConnectionState =
  | "draft"
  | "active"
  | "inactive"
  | "validating";

/**
 * Structural port covering only the calls we make. Defined by our needs rather
 * than `Pick<WorkOS, …>` so tests can supply a plain object without casting
 * past the SDK's class-private members.
 */
export type WorkOSClient = {
  organizations: {
    createOrganization(payload: { name: string }): Promise<{ id: string }>;
    getOrganization(id: string): Promise<{
      domains: { domain: string; state: string }[];
    }>;
  };
  adminPortal: {
    generateLink(options: {
      intent: "sso" | "domain_verification";
      organization: string;
      returnUrl?: string;
    }): Promise<{ link: string }>;
  };
  sso: {
    listConnections(options: {
      organizationId?: string;
      limit?: number;
    }): Promise<{ data: { state: WorkOSConnectionState }[] }>;
    getConnection(id: string): Promise<{ organizationId?: string }>;
  };
};

let cached: WorkOS | undefined;

export function isWorkOSConfigured(): boolean {
  return Boolean(process.env.WORKOS_API_KEY);
}

// Constructed lazily: instantiating at module scope would throw on boot for
// self-hosted instances that never set WORKOS_API_KEY.
export function getRawWorkOS(): WorkOS {
  if (!cached) {
    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new PreconditionFailedError(
        "SSO is not configured on this instance",
      );
    }
    cached = new WorkOS(apiKey, { clientId: process.env.AUTH_WORKOS_ID });
  }
  return cached;
}

export function getDefaultWorkOS(): WorkOSClient {
  return getRawWorkOS();
}

export function resolveWorkOS(client: WorkOSClient | undefined): WorkOSClient {
  return client ?? getDefaultWorkOS();
}
