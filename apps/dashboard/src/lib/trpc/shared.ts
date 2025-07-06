import type { HTTPBatchLinkOptions, HTTPHeaders, TRPCLink } from "@trpc/client";
import { httpBatchLink } from "@trpc/client";

import type { AppRouter } from "@openstatus/api";
import superjson from "superjson";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  const vc = process.env.VERCEL_URL;
  // if (vc) return `https://${vc}`;
  if (vc) return "https://app.openstatus.dev";
  return "http://localhost:3000";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
