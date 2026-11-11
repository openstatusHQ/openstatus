import { getStatusPageBaseUrl } from "@openstatus/utils";

export function getBaseUrl({
  slug,
  customDomain,
}: {
  slug?: string;
  customDomain?: string | null;
}) {
  return getStatusPageBaseUrl({ slug, customDomain });
}
