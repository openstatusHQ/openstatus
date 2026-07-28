import "server-only";
import { type AppRouter, appRouter, createTRPCContext } from "@openstatus/api";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
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

/**
 * RSC has no `NextRequest`, so synthesize one from the incoming headers —
 * `NextRequest` derives `.cookies` from the `cookie` header, which is all
 * the tRPC context reads (workspace-slug) besides UA / forwarded-for.
 * The URL is a placeholder; nothing in the context inspects it.
 */
const createRSCContext = cache(async () => {
  const headerList = await headers();
  const req = new NextRequest("https://dashboard.internal/rsc", {
    headers: headerList,
  });
  return createTRPCContext({ req, auth });
});

// Calls procedures in-process. This used to be an httpBatchLink pointed back
// at our own /api/trpc/lambda, which meant every RSC render paid a real HTTPS
// round-trip, a second lambda invocation and a second `auth()` before any
// query ran. Both run on Node, so there is nothing to bridge.
export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: createRSCContext,
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
    if (isNotFound(error)) notFound();
    throw error;
  }
}

/**
 * The in-process caller throws `TRPCError`; `TRPCClientError` only appears if
 * a caller still goes over the wire. Matched on `name` rather than
 * `instanceof` — a duplicated `@trpc/server` copy in the RSC bundle would
 * break identity and silently turn every `notFound()` gate into a 500. tRPC
 * duck-types the same way internally (`getTRPCErrorFromUnknown`).
 */
function isNotFound(error: unknown): boolean {
  if (error instanceof TRPCClientError) return error.data?.code === "NOT_FOUND";
  return (
    error instanceof Error &&
    error.name === "TRPCError" &&
    (error as { code?: string }).code === "NOT_FOUND"
  );
}
