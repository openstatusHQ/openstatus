import * as z from "zod";

// we could flatten the proxy?
export const logDrainSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().optional(),
  requestId: z.string().optional(),
  statusCode: z.number().optional(), // min max 100 - 599
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
  proxy: z.unknown().optional(), // TODO: flatten it afterwards?
  // "proxy": {
  //     "timestamp": 1669188856020,
  //     "region": "fra1",
  //     "method": "GET",
  //     "vercelCache": "MISS",
  //     "statusCode": 301,
  //     "path": "/external-rewrite",
  //     "host": "my-app.vercel.app",
  //     "scheme": "https",
  //     "clientIp": "xxx.xxx.xxx.xxx",
  //     "userAgent": [
  //         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
  //     ]
  // },
});

export const logDrainSchemaArray = z.array(logDrainSchema);
