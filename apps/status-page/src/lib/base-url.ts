export function getBaseUrl({
  slug,
  customDomain,
}: {
  slug?: string;
  customDomain?: string;
}) {
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3000/${slug}`;
  }
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return `https://${slug}.openstatus.dev`;
}
