import * as z from "zod";

/**
 * If the response of the request returns an HTTP statusCode with a value of -1,
 * that means there was no response returned and the lambda crashed.
 * In the same response, if the value of proxy.statusCode is returned with -1,
 * that means the revalidation occurred in the background.
 */

// https://vercel.com/docs/observability/log-drains-overview/log-drains-reference#json-log-drains
export const logDrainSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().optional(),
  requestId: z.string().optional(),
  statusCode: z.number().optional(),
  message: z.string().optional(),
  projectId: z.string().optional(),
  deploymentId: z.string().optional(),
  buildId: z.string().optional(),
  source: z.enum(["external", "lambda", "edge", "static", "build"]),
  host: z.string().optional(),
  environment: z.string().optional(),
  branch: z.string().optional(),
  destination: z.string().optional(),
  path: z.string().optional(),
  entrypoint: z.string().optional(),
  proxy: z
    .object({
      timestamp: z.number().optional(),
      region: z.string().optional(), // TODO: use regions enum?
      method: z.string().optional(), // TODO: use methods enum?
      vercelCache: z.string().optional(), // TODO: use "HIT" / "MISS" enum?
      statusCode: z.number().optional(),
      path: z.string().optional(),
      host: z.string().optional(),
      scheme: z.string().optional(),
      clientIp: z.string().optional(),
      userAgent: z.array(z.string()).optional(),
    })
    .optional(),
});

export const logDrainSchemaArray = z.array(logDrainSchema);
