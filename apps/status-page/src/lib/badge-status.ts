import type { Status } from "@openstatus/tracker";
import { componentStatus } from "@/content/status-vocab";
import { getQueryClient, trpc } from "@/lib/trpc/server";

/**
 * Shared helper to fetch badge status for a domain/slug
 * Handles errors gracefully by returning "unknown" status
 * Converts internal status format to external Statuspage-compatible format
 */
export async function getBadgeStatus(
  domain: string,
): Promise<Status> {
  const queryClient = getQueryClient();
  
  // Use lightweight badge-specific procedure and handle errors gracefully
  let data;
  try {
    data = await queryClient.fetchQuery(
      trpc.statusPage.getBadgeStatus.queryOptions({ slug: domain }),
    );
  } catch {
    // Map query errors to null so non-existent/error cases show Unknown badge
    data = null;
  }
  
  // Convert internal status format (success/degraded/error/info) to external format (operational/degraded_performance/etc)
  // If page doesn't exist or query failed, show unknown status instead of defaulting to success/operational
  const status = !data
    ? "unknown"
    : (componentStatus(data.status) as Status);
  
  return status;
}
