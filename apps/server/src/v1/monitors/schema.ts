import { z } from "@hono/zod-openapi";

import {
  flyRegions,
  monitorMethods,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema";

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
          if (String(val).length > 0) {
            return String(val).split(",");
          }
          return [];
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
          if (String(val).length > 0) {
            return JSON.parse(String(val));
          }
          return [];
        },
        z.array(z.object({ key: z.string(), value: z.string() })).default([]),
      )
      .nullish()
      .openapi({
        description: "The headers of your request",
        example: [{ key: "x-apikey", value: "supersecrettoken" }],
      }),
    active: z
      .boolean()
      .default(false)
      .openapi({ description: "If the monitor is active" }),
    public: z
      .boolean()
      .default(false)
      .openapi({ description: "If the monitor is public" }),
  })
  .openapi({
    description: "The monitor",
    required: ["periodicity", "url", "regions", "method"],
  });

export type MonitorSchema = z.infer<typeof MonitorSchema>;
