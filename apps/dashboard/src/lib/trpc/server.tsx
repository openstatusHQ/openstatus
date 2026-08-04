import "server-only";
import { appRouter, createTRPCContext } from "@openstatus/api";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import {
  type ResolverDef,
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import { cache } from "react";

import { auth } from "@/lib/auth";

import { makeQueryClient } from "./query-client";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

// `cache` is load-bearing: the options proxy unwraps this factory on every
// procedure call, so without it each prefetch would re-run `auth()`.
const getContext = cache(async () => {
  const incoming = await headers();
  return createTRPCContext({
    // NextRequest derives `cookies` from the cookie header, and `ctx.req` is
    // only ever read for cookies and headers.
    req: new NextRequest("http://rsc.internal", {
      headers: new Headers(incoming),
    }),
    auth,
  });
});

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: getContext,
  queryClient: getQueryClient,
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
    // Direct router calls throw `TRPCError`; the browser client throws
    // `TRPCClientError`. Both reach here depending on the caller.
    const code =
      error instanceof TRPCError
        ? error.code
        : error instanceof TRPCClientError
          ? error.data?.code
          : undefined;
    if (code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
