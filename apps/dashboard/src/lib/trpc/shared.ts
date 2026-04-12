import type { HTTPBatchLinkOptions, HTTPHeaders, TRPCLink } from "@trpc/client";
import { httpBatchLink } from "@trpc/client";

import type { AppRouter } from "@openstatus/api";
import superjson from "superjson";

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

const lambdas = [
  "stripeRouter",
  "emailRouter",
  "apiKeyRouter",
  "integrationRouter",
  "blob",
];

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
