import { POPULAR_STATUS } from "../../../data/popular-status";

// tRPC inputs shared by the server prefetch (./prefetch.ts) and the client
// reads (./sections.tsx). They must be identical for hydration to hit, and
// they cover the whole list so every page shares one cache entry;
// exclusions and limits are applied after the read.
export const POPULAR_SERVICES_INPUT = {
  slugs: POPULAR_STATUS.flatMap((e) => ("component" in e ? [] : [e.service])),
};
export const POPULAR_COMPONENTS_INPUT = {
  refs: POPULAR_STATUS.flatMap((e) =>
    "component" in e ? [{ service: e.service, component: e.component }] : [],
  ),
};
