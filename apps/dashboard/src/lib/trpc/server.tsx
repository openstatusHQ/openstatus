import "server-only";
import type { AppRouter } from "@openstatus/api";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import {
  type ResolverDef,
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { makeQueryClient } from "./query-client";
import { endingLink, sentryLoggerLink } from "./shared";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  client: createTRPCClient({
    links: [
      sentryLoggerLink(),
      endingLink({
        headers: {
          "x-trpc-source": "server",
        },
        // `typeof fetch` carries a `preconnect` static (React 19 typings) that
        // tRPC's link will never invoke — cast the call-signature wrapper.
        fetch: (async (url, options) => {
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
        }) as typeof fetch,
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

// oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();

  if (queryOptions.queryKey[1]?.type === "infinite") {
    // oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

// oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptionsArray: T[],
) {
  const queryClient = getQueryClient();

  for (const queryOptions of queryOptionsArray) {
    if (queryOptions.queryKey[1]?.type === "infinite") {
      // oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
      void queryClient.prefetchInfiniteQuery(queryOptions as any);
    } else {
      void queryClient.prefetchQuery(queryOptions);
    }
  }
}

// Duck-typed rather than `instanceof TRPCClientError`: that check fails across
// bundle boundaries, and an in-process caller throws `TRPCError` (bare `code`,
// no `data`). tRPC matches on the same fields internally for this reason.
function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, data } = error as {
    code?: unknown;
    data?: { code?: unknown } | null;
  };
  return code === "NOT_FOUND" || data?.code === "NOT_FOUND";
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
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}
