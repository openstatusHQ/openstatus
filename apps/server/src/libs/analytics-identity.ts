import type { IdentifyProps } from "@openstatus/analytics";
import type { Workspace } from "@openstatus/db/src/schema";

/**
 * The OpenPanel identity for API traffic: one `api_<workspaceId>` profile per
 * workspace, shared by the V1 REST and ConnectRPC surfaces.
 */
export function apiAnalyticsIdentity(
  workspace: Workspace,
  headers: Headers,
): IdentifyProps {
  return {
    userId: `api_${workspace.id}`,
    workspaceId: `${workspace.id}`,
    workspaceName: workspace.name || workspace.slug,
    plan: workspace.plan,
    source: "api",
    location:
      headers.get("fly-client-ip") ||
      headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
      undefined,
    userAgent: headers.get("user-agent") ?? undefined,
  };
}
