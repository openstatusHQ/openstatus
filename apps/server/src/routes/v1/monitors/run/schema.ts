import { z } from "@hono/zod-openapi";

export const QuerySchema = z
  .object({
    "no-wait": z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .prefault("false")
      .openapi({
        description: "Don't wait for the result",
      }),
  })
  .openapi({
    description: "Query parameters",
  });
