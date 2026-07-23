import {
  getExternalServiceBySlug,
  listExternalServices,
} from "@openstatus/services/external-service";
import {
  getExternalComponentBySlug,
  listExternalComponentsBySlug,
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
