/**
 * While developing, we can also access the status page via /status-page/:domain
 */
export function setPrefixUrl(value: string, params: { domain: string }) {
  const suffix = value.startsWith("/") ? value : `/${value}`;
  if (process.env.NODE_ENV === "development") {
    return `/status-page/${params.domain}${suffix}`;
  }
  return suffix;
}

export function createProtectedCookieKey(value: string) {
  return `secured-${value}`;
}

export function getBaseUrl({
  slug,
  customDomain,
}: {
  slug: string;
  customDomain?: string;
}) {
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3000/status-page/${slug}`;
  }
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return `https://${slug}.openstatus.dev`;
}
