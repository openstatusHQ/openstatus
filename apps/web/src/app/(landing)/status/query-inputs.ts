import {
  POPULAR_STATUS_COMPONENTS,
  POPULAR_STATUS_SLUGS,
} from "../../../data/popular-status";

// tRPC inputs shared by the server prefetch (./prefetch.ts) and the client
// reads (./sections.tsx). They must be identical for hydration to hit, and
// they are the full lists so every page shares one cache entry; exclusions
// and limits are applied after the read.
export const POPULAR_SERVICES_INPUT = { slugs: [...POPULAR_STATUS_SLUGS] };
export const POPULAR_COMPONENTS_INPUT = {
  refs: POPULAR_STATUS_COMPONENTS.map((r) => ({ ...r })),
};
