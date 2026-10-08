import {
  HydrationBoundary,
  type QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import {
  type ResolverDef,
  type TRPCOptionsProxy,
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import { type ReactNode, cache, createElement } from "react";

import { type AppRouter, appRouter } from "./root";
import { createTRPCContext } from "./trpc";

type AuthFn = NonNullable<Parameters<typeof createTRPCContext>[0]["auth"]>;

/**
 * Builds the per-app RSC tRPC helpers around a direct, in-process router proxy
 * (no HTTP hop). `auth` is passed lazily so an app whose auth module imports
 * these helpers doesn't hit a circular-init TDZ.
 */
export function createServerHelpers(opts: {
  makeQueryClient: () => QueryClient;
  auth?: AuthFn;
}) {
  // Stable per-request getter so the same client is reused across a request.
  const getQueryClient = cache(opts.makeQueryClient);

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
      auth: opts.auth,
    });
  });

  // Annotated (not inferred) so the exported type stays nameable across the
  // package boundary — the inferred proxy type reaches into non-portable
  // drizzle/libsql/theme-store paths (TS2742).
  const trpc: TRPCOptionsProxy<AppRouter> = createTRPCOptionsProxy({
    router: appRouter,
    ctx: getContext,
    queryClient: getQueryClient,
  });

  function HydrateClient(props: { children: ReactNode }) {
    const queryClient = getQueryClient();
    return createElement(
      HydrationBoundary,
      { state: dehydrate(queryClient) },
      props.children,
    );
  }

  // oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
  function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
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
  function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
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
  async function fetchQueryOrNotFound<
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

  return {
    trpc,
    getQueryClient,
    HydrateClient,
    prefetch,
    batchPrefetch,
    fetchQueryOrNotFound,
  };
}
