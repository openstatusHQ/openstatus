import type { ServiceContext } from "../context";
import { resolveWorkOS } from "./client";
import { isWorkOSConfigured } from "./client";
import { listSsoDomains } from "./internal";
import { reconcileSsoDomains } from "./sync-domains";

export type SsoConnectionState = "none" | "pending" | "active" | "inactive";

export type SsoConfig = {
  configured: boolean;
  enabled: boolean;
  organizationId: string | null;
  connection: SsoConnectionState;
  domains: {
    domain: string;
    verifiedAt: Date | null;
  }[];
  ready: boolean;
};

/**
 * Connection state is read live from WorkOS rather than mirrored; domain rows
 * are mirrored, so this read also reconciles them against WorkOS.
 */
export async function getSsoConfig(args: {
  ctx: ServiceContext;
}): Promise<SsoConfig> {
  const { ctx } = args;

  const rows = await listSsoDomains(ctx);
  let domains = rows.map((row) => ({
    domain: row.domain,
    verifiedAt: row.verifiedAt,
  }));

  const organizationId = ctx.workspace.workosOrganizationId ?? null;

  let connection: SsoConnectionState = "none";
  if (organizationId && isWorkOSConfigured()) {
    const workos = resolveWorkOS(ctx.workos);
    domains = await reconcileSsoDomains({
      ctx,
      organizationId,
      workos,
      local: domains,
    });
    const list = await workos.sso.listConnections({
      organizationId,
      limit: 1,
    });
    const first = list.data[0];
    if (!first) {
      connection = "pending";
    } else if (first.state === "active") {
      connection = "active";
    } else if (first.state === "inactive") {
      connection = "inactive";
    } else {
      connection = "pending";
    }
  }

  const hasVerifiedDomain = domains.some((entry) => entry.verifiedAt !== null);

  return {
    configured: Boolean(organizationId),
    enabled: ctx.workspace.ssoEnabled,
    organizationId,
    connection,
    domains,
    ready:
      ctx.workspace.ssoEnabled && connection === "active" && hasVerifiedDomain,
  };
}
