import { z } from "@hono/zod-openapi";
import { ParamsSchema } from "../schema";

export { ParamsSchema };

export const SummarySchema = z.object({
  ok: z.number().int().openapi({
    description:
      "The number of ok responses (defined by the assertions - or by default status code 200)",
  }),
  count: z
    .number()
    .int()
    .openapi({ description: "The total number of request" }),
  day: z.coerce
    .date()
    .openapi({ description: "The date of the daily stat in ISO8601 format" }),
});

export type SummarySchema = z.infer<typeof SummarySchema>;
