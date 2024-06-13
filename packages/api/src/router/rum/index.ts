import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const event = z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);

const _RouteData = z.object({
  href: z.string(),
  total_event: z.coerce.number(),
  clsValue: z.number().optional(),
  fcpValue: z.number().optional(),
  inpValue: z.number().optional(),
  lcpValue: z.number().optional(),
  ttfbValue: z.number().optional(),
});

export const rumRouter = createTRPCRouter({
  GetEventMetricsForWorkspace: protectedProcedure
    .input(
      z.object({
        event: event,
      }),
    )
    .query((_opts) => {
      // FIXME: Use tb pipe instead
      return null;
    }),

  GetAggregatedPerPage: protectedProcedure.query((_opts) => {
    // FIXME: Use tb pipe instead
    return null;
  }),
});
