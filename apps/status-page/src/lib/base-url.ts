import { getStatusPageBaseDomain } from "./base-domain";

export function getBaseUrl({
  slug,
  customDomain,
  baseDomain,
}: {
  slug?: string;
  customDomain?: string;
  /**
   * Defaults to `STATUS_PAGE_BASE_DOMAIN`, which only the server can read.
   * Client components must pass the value they received from the server.
   */
  baseDomain?: string;
}) {
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3000/${slug}`;
  }
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return `https://${slug}.${baseDomain ?? getStatusPageBaseDomain()}`;
}
