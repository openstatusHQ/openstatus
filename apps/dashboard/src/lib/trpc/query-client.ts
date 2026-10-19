import * as Sentry from "@sentry/nextjs";
import {
  QueryCache,
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";

import { isExpectedNotFound } from "./error";

export function makeQueryClient() {
  return new QueryClient({
    // `prefetchQuery` swallows rejections, so the cache is the only place left
    // to observe a failed server-side prefetch.
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isExpectedNotFound(error, query.meta?.expectNotFound)) return;
        Sentry.captureException(error, {
          extra: { queryHash: query.queryHash },
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {},
    },
  });
}
