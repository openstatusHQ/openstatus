import {
  getExternalServiceBySlug,
  listExternalServiceSlugs,
  listExternalServices,
} from "@openstatus/services/external-service";
import { unstable_cache } from "next/cache";

const REVALIDATE_SECONDS = 3600; // 1 hour
const TAG = "external-services";

export const cachedListExternalServices = unstable_cache(
  async () => listExternalServices({}),
  ["external-services:list"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const cachedListExternalServiceSlugs = unstable_cache(
  async () => listExternalServiceSlugs(),
  ["external-services:slugs"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const cachedGetExternalServiceBySlug = unstable_cache(
  async (slug: string) => getExternalServiceBySlug({ slug }),
  ["external-services:by-slug"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);
