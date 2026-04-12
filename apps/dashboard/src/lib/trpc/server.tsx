import "server-only";

import type { AppRouter } from "@openstatus/api";

import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient, loggerLink } from "@trpc/client";
import {
  type ResolverDef,
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { makeQueryClient } from "./query-client";
import { endingLink } from "./shared";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      endingLink({
        headers: {
          "x-trpc-source": "server",
        },
        fetch: async (url, options) => {
          const cookieStore = await cookies();
          console.log("[dashboard trpc server] fetch", {
            hasSessionToken:
              !!cookieStore.get("__Secure-authjs.session-token")?.value ||
              !!cookieStore.get("authjs.session-token")?.value,
          });
          return fetch(url, {
            ...options,
            credentials: "include",
            headers: {
              ...options?.headers,
              cookie: cookieStore.toString(),
            },
          });
        },
      }),
    ],
  }),
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: FIXME: remove any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();

  if (queryOptions.queryKey[1]?.type === "infinite") {
    // biome-ignore lint/suspicious/noExplicitAny: FIXME: remove any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: FIXME: remove any
export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptionsArray: T[],
) {
  const queryClient = getQueryClient();

  for (const queryOptions of queryOptionsArray) {
    if (queryOptions.queryKey[1]?.type === "infinite") {
      // biome-ignore lint/suspicious/noExplicitAny: FIXME: remove any
      void queryClient.prefetchInfiniteQuery(queryOptions as any);
    } else {
      void queryClient.prefetchQuery(queryOptions);
    }
  }
}

/**
 * Fetches a query and calls `notFound()` if the server returns NOT_FOUND.
 * Use this for gating queries in layouts where the resource must exist.
 */
export async function fetchQueryOrNotFound<
  T extends ReturnType<TRPCQueryOptions<ResolverDef>>,
>(queryOptions: T) {
  const queryClient = getQueryClient();
  try {
    return (await queryClient.fetchQuery(queryOptions)) as Awaited<
      ReturnType<Extract<T["queryFn"], (...args: never[]) => unknown>>
    >;
  } catch (error) {
    if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
