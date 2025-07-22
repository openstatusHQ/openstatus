import { z } from "@hono/zod-openapi";

import { numberCompare, stringCompare } from "@openstatus/assertions";
import { monitorJobTypes, monitorMethods } from "@openstatus/db/src/schema";
import {
  flyRegions,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/constants";
import { ZodError } from "zod";

const statusAssertion = z
  .object({
    type: z.literal("status"),
    compare: numberCompare.openapi({
      description: "The comparison to run",
      example: "eq",
    }),
    target: z
      .number()
      .int()
      .positive()
      .openapi({ description: "The target value" }),
  })
  .openapi({
    description: "The status assertion",
  });

const headerAssertion = z
  .object({
    type: z.literal("header"),
    compare: stringCompare,
    key: z.string().openapi({
      description: "The key of the header",
    }),
    target: z.string().openapi({
      description: "the header value",
    }),
  })
  .openapi({ description: "The header assertion" });

const textBodyAssertion = z
  .object({
    type: z.literal("textBody"),
    compare: stringCompare,
    target: z.string().openapi({
      description: "The target value",
    }),
  })
  .openapi({ description: "The text body assertion" });

//   Not used yet
const _jsonBodyAssertion = z.object({
  type: z.literal("jsonBody"),
  path: z.string(), // https://www.npmjs.com/package/jsonpath-plus
  compare: stringCompare,
  target: z.string(),
});

export const assertion = z.discriminatedUnion("type", [
  statusAssertion,
  headerAssertion,
  textBodyAssertion,
  // jsonBodyAssertion,
]);

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the monitor",
      example: "1",
    }),
});

export const MonitorSchema =
  z.object({
    id: z.number().openapi({
      example: 123,
      description: "The id of the monitor",
    }),
    periodicity: monitorPeriodicitySchema.openapi({
      example: "1m",
      description: "How often the monitor should run",
    }),
    url: z.string().openapi({
      example: "https://www.documenso.co",
      description: "The url to monitor",
    }),
    regions: z
      .preprocess(
        (val) => {
          try {
            if (Array.isArray(val)) return val;
            if (String(val).length > 0) {
              return String(val).split(",");
            }
            return [];
          } catch (e) {
            throw new ZodError([
              {
                code: "custom",
                path: ["headers"],
                message: e instanceof Error ? e.message : "Invalid value",
              },
            ]);
          }
        },
        z.array(z.enum(flyRegions)),
      )
      .default([])
      .openapi({
        example: ["ams"],
        description: "Where we should monitor it",
      }),
    name: z.string().openapi({
      example: "Documenso",
      description: "The name of the monitor",
    }),
    description: z.string().optional().openapi({
      example: "Documenso website",
      description: "The description of your monitor",
    }),
    method: z.enum(monitorMethods).openapi({ example: "GET" }),
    body: z
      .preprocess((val) => {
        return String(val);
      }, z.string())
      .nullish()
      .default("")
      .openapi({
        example: "Hello World",
        description: "The body",
      }),
    headers: z
      .preprocess(
        (val) => {
          try {
            if (Array.isArray(val)) return val;
            if (String(val).length > 0) {
              return JSON.parse(String(val));
            }
            return [];
          } catch (e) {
            throw new ZodError([
              {
                code: "custom",
                path: ["headers"],
                message: e instanceof Error ? e.message : "Invalid value",
              },
            ]);
          }
        },
        z.array(z.object({ key: z.string(), value: z.string() })).default([]),
      )
      .nullish()
      .openapi({
        description: "The headers of your request",
        example: [{ key: "x-apikey", value: "supersecrettoken" }],
      }),
    assertions: z
      .preprocess((val) => {
        try {
          if (Array.isArray(val)) return val;
          if (String(val).length > 0) {
            return JSON.parse(String(val));
          }
          return [];
        } catch (e) {
          throw new ZodError([
            {
              code: "custom",
              path: ["assertions"],
              message: e instanceof Error ? e.message : "Invalid value",
            },
          ]);
        }
      }, z.array(assertion))
      .nullish()
      .default([])
      .openapi({
        description: "The assertions to run",
      }),
    active: z
      .boolean()
      .default(false)
      .openapi({ description: "If the monitor is active" }),
    public: z
      .boolean()
      .default(false)
      .openapi({ description: "If the monitor is public" }),
    degradedAfter: z.number().nullish().openapi({
      description:
        "The time after the monitor is considered degraded in milliseconds",
    }),
    timeout: z.number().nullish().default(45000).openapi({
      description: "The timeout of the request in milliseconds",
    }),
    retry: z.number().default(3).openapi({
      description: "The number of retries to attempt",
    }),
    jobType: z.enum(monitorJobTypes).optional().default("http").openapi({
      description: "The type of the monitor",
    }),
    openTelemetry: z.object({
      endpoint: z.string().url().optional().default("http://localhost:4317").openapi({
        description: "The endpoint of the OpenTelemetry collector",
      }),
      headers: z.record(z.string()).optional().default({}).openapi({
        description: "The headers to send to the OpenTelemetry collector",
      }),
    }).optional().openapi({
      description: "The OpenTelemetry configuration",
    }),
  })
  .openapi("Monitor");

export type MonitorSchema = z.infer<typeof MonitorSchema>;

// TODO: Move to @/libs/checker/schema
const timingSchema = z.object({
  dnsStart: z.number(),
  dnsDone: z.number(),
  connectStart: z.number(),
  connectDone: z.number(),
  tlsHandshakeStart: z.number(),
  tlsHandshakeDone: z.number(),
  firstByteStart: z.number(),
  firstByteDone: z.number(),
  transferStart: z.number(),
  transferDone: z.number(),
});

// Use a baseSchema with 'latency', 'region', 'timestamp'

export const HTTPTriggerResult = z.object({
  jobType: z.literal("http"),
  status: z.number(),
  latency: z.number(),
  region: z.enum(flyRegions),
  timestamp: z.number(),
  timing: timingSchema,
  body: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});

const tcptimingSchema = z.object({
  tcpStart: z.number(),
  tcpDone: z.number(),
});

export const TCPTriggerResult = z.object({
  jobType: z.literal("tcp"),
  latency: z.number(),
  region: z.enum(flyRegions),
  timestamp: z.number(),
  timing: tcptimingSchema,
  // check if it should be z.coerce.boolean()?
  error: z.number().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
});

export const TriggerResult = z.discriminatedUnion("jobType", [
  HTTPTriggerResult,
  TCPTriggerResult,
]);

export const ResultRun = z.object({
  latency: z.number().int(), // in ms
  statusCode: z.number().int().nullable().default(null),
  monitorId: z.string().default(""),
  url: z.string().optional(),
  error: z.coerce.boolean().default(false),
  region: z.enum(flyRegions),
  timestamp: z.number().int().optional(),
  message: z.string().nullable().optional(),
  timing: z
    .preprocess((val) => {
      if (!val) return null;
      const value = timingSchema.safeParse(JSON.parse(String(val)));
      if (value.success) return value.data;
      return null;
    }, timingSchema.nullable())
    .optional(),
});

const baseRequest = z.object({
  name: z.string().openapi({
    description: "Name of the monitor",
  }),
  description: z.string().optional(),
  retry: z
    .number()
    .max(10)
    .min(1)
    .optional()
    .openapi({
      description: "Number of retries to attempt",
      examples: [1, 3, 5],
      default: 3,
    }),
  degradedAfter: z
    .number()
    .min(0)
    .optional()
    .openapi({
      description:
        "Time in milliseconds to wait before marking the request as degraded",
      examples: [30000],
      default: 30000,
    }),
  timeout: z
    .number()
    .min(0)
    .optional()
    .openapi({
      description:
        "Time in milliseconds to wait before marking the request as timed out",
      examples: [45000],
      default: 45000,
    }),
  frequency: z.enum(["30s", "1m", "5m", "10m", "30m", "1h"]),
  active: z.boolean().optional().openapi({
    description: "Whether the monitor is active",
    default: false,
  }),
  public: z.boolean().optional().openapi({
    description: "Whether the monitor is public",
    default: false,
  }),
  regions: z.array(z.enum(flyRegions)).openapi({
    description: "Regions to run the request in",
  }),
  openTelemetry: z.object({
    endpoint: z
      .string()
      .url()
      .optional()
      .openapi({
        description: "OTEL endpoint to send metrics to",
        examples: ["https://otel.example.com"],
      }),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .openapi({
        description: "Headers to send with the OTEL request",
        examples: [{ "Content-Type": "application/json" }],
      }),
  }).nullish(),
});

const httpRequestSchema = z.object({
  method: z.enum(monitorMethods),
  url: z
    .string()
    .url()
    .openapi({
      description: "URL to request",
      examples: ["https://openstat.us", "https://www.openstatus.dev"],
    }),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .openapi({
      description: "Headers to send with the request",
      examples: [{ "Content-Type": "application/json" }],
    }),
  body: z
    .string()
    .optional()
    .openapi({
      description: "Body to send with the request",
      examples: ['{ "key": "value" }', "Hello World"],
    }),
});

const tcpRequestSchema = z.object({
  host: z.string().openapi({
    examples: ["example.com", "localhost"],
    description: "Host to connect to",
  }),
  port: z.number().openapi({
    description: "Port to connect to",
    examples: [80, 443, 1337],
  }),
});

const statusCodeAssertion = z
  .object({
    kind: z.literal("statusCode"),
    compare: numberCompare.openapi({
      description: "Comparison operator",
      examples: ["eq", "not_eq", "gt", "gte", "lt", "lte"],
    }),
    target: z.number().openapi({
      description: "Status code to assert",
      examples: [200, 404, 418, 500],
    }),
  })
  .openapi({
    examples: [
      {
        kind: "statusCode",
        compare: "eq",
        target: 200,
      },
      {
        kind: "statusCode",
        compare: "not_eq",
        target: 404,
      },
      {
        kind: "statusCode",
        compare: "gt",
        target: 300,
      },
    ],
  });

const headerAssertions = z.object({
  kind: z.literal("header"),
  compare: stringCompare.openapi({
    description: "Comparison operator",
    examples: ["eq", "not_eq", "contains", "not_contains"],
  }),
  key: z.string().openapi({
    description: "Header key to assert",
    examples: ["Content-Type", "X-Request-ID"],
  }),
  target: z.string().openapi({
    description: "Header value to assert",
    examples: ["application/json", "text/html"],
  }),
});

const textBodyAssertions = z.object({
  kind: z.literal("textBody"),
  compare: stringCompare.openapi({
    description: "Comparison operator",
    examples: ["eq", "not_eq", "contains", "not_contains"],
  }),
  target: z.string().openapi({
    description: "Text body to assert",
    examples: ["Hello, world!", "404 Not Found"],
  }),
});

export const assertionsSchema = z.discriminatedUnion("kind", [
  statusCodeAssertion,
  headerAssertions,
  textBodyAssertions,
]);

export const HTTPMonitorSchema = baseRequest
  .extend({
    assertions: z.array(assertionsSchema).optional().openapi({
      description: "Assertions to run on the response",
    }),
    request: httpRequestSchema.openapi({
      description: "The HTTP Request we are sending",
    }),
  })
  .openapi({
    title: "HTTP Monitor Schema",
  });

export const TCPMonitorSchema = baseRequest
  .extend({
    request: tcpRequestSchema.openapi({
      description: "The TCP Request we are sending",
    }),
  })
  .openapi({
    title: "TCP Monitor Schema",
  });
