const DEFAULT_DASHBOARD_PUBLIC_URL = "http://localhost:3000";

export function getDashboardPublicUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || DEFAULT_DASHBOARD_PUBLIC_URL;
  return baseUrl.replace(/\/$/, "");
}
