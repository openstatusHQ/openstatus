import type { HTTPBatchLinkOptions, HTTPHeaders, TRPCLink } from "@trpc/client";
import { httpBatchLink } from "@trpc/client";
import type { TRPCError } from "@trpc/server";

import type { AppRouter } from "@openstatus/api";
import superjson from "superjson";

/**
 * Shared onError handler for tRPC route handlers.
 * Ignores input validation errors from external traffic (bots/crawlers)
 * hitting the tRPC endpoint with malformed batch URLs.
 * Our tRPC clients always set `x-trpc-source`; its absence means the
 * request didn't come from our app. Only suppresses BAD_REQUEST so that
 * other error types (UNAUTHORIZED, INTERNAL_SERVER_ERROR, etc.) are
 * still logged regardless of source.
 */
export function createOnError(req: Request, label: string) {
  return ({ error }: { error: TRPCError }) => {
    if (error.code === "BAD_REQUEST" && !req.headers.get("x-trpc-source"))
      return;
    console.log(`Error in tRPC handler (${label})`);
    console.error(error);
  };
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  // Note: status-page has its own tRPC API routes
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // Vercel
  return "http://localhost:3000"; // Local dev and Docker (internal calls)
};

const lambdas = ["stripeRouter", "emailRouter"];

export const endingLink = (opts?: {
  fetch?: typeof fetch;
  headers?: HTTPHeaders | (() => HTTPHeaders | Promise<HTTPHeaders>);
}) =>
  ((runtime) => {
    const sharedOpts = {
      headers: opts?.headers,
      fetch: opts?.fetch,
      transformer: superjson,
      // biome-ignore lint/suspicious/noExplicitAny: FIXME: remove any
    } satisfies Partial<HTTPBatchLinkOptions<any>>;

    const edgeLink = httpBatchLink({
      ...sharedOpts,
      url: `${getBaseUrl()}/api/trpc/edge`,
    })(runtime);
    const lambdaLink = httpBatchLink({
      ...sharedOpts,
      url: `${getBaseUrl()}/api/trpc/lambda`,
    })(runtime);

    return (ctx) => {
      const path = ctx.op.path.split(".") as [string, ...string[]];
      const endpoint = lambdas.includes(path[0]) ? "lambda" : "edge";

      const newCtx = {
        ...ctx,
        op: { ...ctx.op, path: path.join(".") },
      };
      return endpoint === "edge" ? edgeLink(newCtx) : lambdaLink(newCtx);
    };
  }) satisfies TRPCLink<AppRouter>;
