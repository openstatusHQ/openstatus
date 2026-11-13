import {
  getConfiguredStatusPageBaseUrl,
  getStatusPageBaseUrl,
} from "@openstatus/utils";

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
    override?.trim() || getConfiguredStatusPageBaseUrl();

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
