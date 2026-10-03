export function buildMonitorBadgeUrl(
  page: { slug: string; customDomain?: string | null },
  monitorId: number | string,
): string {
  const host = page.customDomain || `${page.slug}.openstatus.dev`;
  return `https://${host}/monitors/${monitorId}/badge/v2`;
}
