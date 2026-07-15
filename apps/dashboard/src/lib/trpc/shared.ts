import type { AppRouter } from "@openstatus/api";
import * as Sentry from "@sentry/nextjs";
import type { HTTPBatchLinkOptions, HTTPHeaders, TRPCLink } from "@trpc/client";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";

/**
 * tRPC logger link that reports failed queries to Sentry directly instead of
 * letting captureConsoleIntegration scrape tRPC's styled console.error format
 * string (which surfaces as noise like "%c << query #1 %c...%c %O").
 *
 * Only the operation `path` is attached — never `input`, which can carry
 * secrets (page passwords, subscriber tokens, emails).
 */
export const sentryLoggerLink = (): TRPCLink<AppRouter> =>
  loggerLink<AppRouter>({
    enabled: (opts) =>
      process.env.NODE_ENV === "development" ||
      (opts.direction === "down" && opts.result instanceof Error),
    logger: (opts) => {
      if (opts.direction === "down" && opts.result instanceof Error) {
        Sentry.captureException(opts.result, {
          extra: { path: opts.path },
        });
        if (process.env.NODE_ENV === "development") {
          console.warn("[tRPC error]", opts.path, opts.result);
        }
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.log(opts);
      }
    },
  });

/**
 * Shared onError handler for tRPC route handlers.
 */
export function createOnError(label: string) {
  return ({ error }: { error: { code: string; message: string } }) => {
    console.log(`Error in tRPC handler (${label})`);
    console.error(error);
  };
}

/**
 * Filter out requests that don't come from our tRPC clients.
 * Our server and client links always set `x-trpc-source`.
 * This is a convention filter for bots/crawlers, not a security boundary —
 * the header is trivially spoofable. Auth is enforced by protectedProcedure.
 */
export function guardTRPCSource(req: Request): Response | null {
  const source = req.headers.get("x-trpc-source");
  if (source !== "server" && source !== "client") {
    return new Response(null, { status: 401 });
  }
  return null;
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  // Note: dashboard has its own tRPC API routes
  if (process.env.VERCEL_URL) return "https://app.openstatus.dev"; // Vercel
  return "http://localhost:3000"; // Local dev and Docker (internal calls)
};

// The whole tRPC surface is served from a single Node.js endpoint — there is
// no longer an Edge/Node split, so all calls go to one link.
export const endingLink =
  (opts?: {
    fetch?: typeof fetch;
    headers?: HTTPHeaders | (() => HTTPHeaders | Promise<HTTPHeaders>);
  }): TRPCLink<AppRouter> =>
  (runtime) =>
    httpBatchLink({
      headers: opts?.headers,
      fetch: opts?.fetch,
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc/lambda`,
      // oxlint-disable-next-line typescript/no-explicit-any -- FIXME: remove any
    } satisfies Partial<HTTPBatchLinkOptions<any>>)(runtime);
