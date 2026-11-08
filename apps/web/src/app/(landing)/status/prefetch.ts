import "server-only";
import type { RouterOutputs } from "@openstatus/api";

import { api, getQueryClient } from "../../../trpc/rq-server";
import {
  POPULAR_COMPONENTS_INPUT,
  POPULAR_SERVICES_INPUT,
} from "./query-inputs";

// Server halves of the blocks in ./sections.tsx: a page awaits the ones it
// renders, then wraps the blocks in <HydrateClient>. Inputs match the
// client reads exactly, so the hydrated data is used without a refetch.

export function prefetchGrid() {
  return api.externalService.grid.prefetch();
}

/** The grid, prefetched once per request and read back from the cache. */
export async function getPrefetchedGrid(): Promise<
  RouterOutputs["externalService"]["grid"]
> {
  await prefetchGrid();
  // tRPC keys are [path, { type }]; the path alone matches this query.
  const [[, data] = []] = getQueryClient().getQueriesData<
    RouterOutputs["externalService"]["grid"]
  >({ queryKey: [["externalService", "grid"]] });
  return data ?? [];
}

/** Data for <PopularStatus />: the pinned services and components. */
export function prefetchPopularStatus() {
  return Promise.all([
    api.externalService.serviceSummaries.prefetch(POPULAR_SERVICES_INPUT),
    api.externalService.componentSummaries.prefetch(POPULAR_COMPONENTS_INPUT),
  ]);
}
