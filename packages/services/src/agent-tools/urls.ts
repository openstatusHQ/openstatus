import { resolveDashboardUrl } from "../incident/effects";

export function dashboardUrl(path: string): string {
  const base = resolveDashboardUrl({
    nodeEnv: process.env.NODE_ENV,
    override: process.env.DASHBOARD_URL,
  });
  return `${base}${path}`;
}

export function statusPageUrl(slug: string): string {
  return `https://${slug}.openstatus.dev`;
}
