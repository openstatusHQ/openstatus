import { z } from "@hono/zod-openapi";

import { monitorJobTypes, monitorMethods } from "@openstatus/db/src/schema";
import {
  flyRegions,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/constants";
import { ZodError } from "zod";
import {
  numberCompare,
  stringCompare,
} from "../../../../../packages/assertions/src/v1";

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

export const MonitorSchema = z
  .object({
    id: z.number().openapi({
      example: 123,
      description: "The id of the monitor",
    }),
    periodicity: monitorPeriodicitySchema.openapi({
      example: "1m",
      description: "How often the monitor should run",
    }),
    url: z.string().url().openapi({
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
    description: z
      .string()
      .openapi({
        example: "Documenso website",
        description: "The description of your monitor",
      })
      .optional(),
    method: z.enum(monitorMethods).default("GET").openapi({ example: "GET" }),
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
      description: "The time after the monitor is considered degraded",
    }),
    timeout: z.number().nullish().default(45000).openapi({
      description: "The timeout of the request",
    }),
    jobType: z
      .enum(monitorJobTypes)
      .openapi({
        description: "The type of the monitor",
      })
      .default("http")
      .optional(),
  })
  .openapi({
    description: "The monitor",
    required: ["periodicity", "url", "regions", "method"],
  });

export type MonitorSchema = z.infer<typeof MonitorSchema>;
