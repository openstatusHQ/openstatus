import {
  getExternalServiceBySlug,
  listExternalServices,
} from "@openstatus/services/external-service";
import {
  getExternalComponentBySlug,
  listExternalComponentsBySlug,
  listRecentlyFetchedServiceIds,
} from "@openstatus/services/external-service-component";
import { unstable_cache } from "next/cache";

const REVALIDATE_SECONDS = 60;
const TAG = "external-services";

export const cachedListExternalServices = unstable_cache(
  async () => listExternalServices({}),
  ["external-services:list"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const cachedGetExternalServiceBySlug = unstable_cache(
  async (slug: string) => getExternalServiceBySlug({ slug }),
  ["external-services:by-slug"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const cachedListExternalComponentsBySlug = unstable_cache(
  async (slug: string) => listExternalComponentsBySlug({ slug }),
  ["external-service-components:by-service"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const cachedGetExternalComponentBySlug = unstable_cache(
  async (serviceSlug: string, componentSlug: string) =>
    getExternalComponentBySlug({ serviceSlug, componentSlug }),
  ["external-service-components:by-slug"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

// Outside a cache scope the Tinybird read (revalidate: 0) makes the prerendered sitemap bail out to dynamic.
export const cachedListRecentlyFetchedServiceIds = unstable_cache(
  async () => listRecentlyFetchedServiceIds({}),
  ["external-services:recently-fetched-ids"],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);
