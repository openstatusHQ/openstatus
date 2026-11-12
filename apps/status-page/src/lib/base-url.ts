import { getStatusPageBaseUrl } from "@openstatus/utils";

export function getBaseUrl({
  slug,
  customDomain,
  override,
}: {
  slug?: string;
  customDomain?: string | null;
  override?: string;
}) {
  const configuredOverride =
    override?.trim() ||
    process.env.STATUS_PAGE_BASE_URL?.trim() ||
    process.env.OPENSTATUS_STATUS_PAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_STATUS_PAGE_BASE_URL?.trim();

  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    !configuredOverride
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
    override: configuredOverride,
  });
}
