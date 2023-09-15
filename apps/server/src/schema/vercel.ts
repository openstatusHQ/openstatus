import { z } from "zod";

// https://vercel.com/docs/observability/log-drains-overview/log-drains-reference#json-log-drains
export const logDrainSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().optional(),
  type: z
    .enum([
      "middleware-invocation",
      "stdout",
      "stderr",
      "edge-function-invocation",
      "fatal",
    ])
    .optional(),
  edgeType: z.enum(["edge-function", "middleware"]).optional(),
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
