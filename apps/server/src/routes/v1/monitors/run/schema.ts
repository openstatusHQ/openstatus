import { z } from "@hono/zod-openapi";

export const QuerySchema = z
  .object({
    "no-wait": z.coerce.boolean().prefault(false).openapi({
      description: "Don't wait for the result",
    }),
  })
  .openapi({
    description: "Query parameters",
  });
