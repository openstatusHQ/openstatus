import { z } from "zod";
import { MonitorSchema } from "../monitors/schema";

export const RunSchema = MonitorSchema.pick({
  url: true,
  body: true,
  headers: true,
  method: true,
  regions: true,
  assertions: true,
})
  .extend({
    runCount: z
      .number()
      .optional()
      .openapi({ description: "The number of times to run the check" }),
    aggregated: z
      .boolean()
      .optional()
      .openapi({ description: "Whether to aggregate the results or not" }),
    //   webhook: z
    //     .string()
    //     .optional()
    //     .openapi({ description: "The webhook to send the result to" }),
  })
  .openapi({
    description: "The single run request",
  });
