import { getStatusPageBaseUrl } from "@openstatus/utils";

export function getBaseUrl({
  slug,
  customDomain,
}: {
  slug?: string;
  customDomain?: string | null;
}) {
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    !process.env.STATUS_PAGE_BASE_URL &&
    !process.env.NEXT_PUBLIC_STATUS_PAGE_BASE_URL
  ) {
    if (customDomain) {
      return customDomain.startsWith("http://") ||
        customDomain.startsWith("https://")
        ? customDomain
        : `https://${customDomain}`;
    }
    return window.location.origin;
  }

  return getStatusPageBaseUrl({
    slug,
    customDomain,
    override:
      process.env.STATUS_PAGE_BASE_URL ||
      process.env.NEXT_PUBLIC_STATUS_PAGE_BASE_URL,
  });
}
