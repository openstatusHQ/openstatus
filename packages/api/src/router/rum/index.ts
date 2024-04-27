import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const event = z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);

export const rumRouter = createTRPCRouter({
  GetEventMetricsForWorkspace: protectedProcedure
    .input(
      z.object({
        event: event,
      }),
    )
    .query(async (opts) => {
      try {
        const data = await opts.ctx.clickhouseClient.query({
          query: `select
      event_name,
      quantile(0.5)(value) as median
    from
        cwv
    where
        dsn = '${opts.ctx.workspace.dsn}'
        and event_name = '${opts.input.event}'
    group by
        event_name
`,
          format: "JSONEachRow",
        });
        const result = await data.json();
        const schema = z.array(
          z.object({ event_name: z.string(), median: z.number() }),
        );
        return schema.parse(result)[0];
      } catch (e) {
        console.error(e);
        throw e;
      }
    }),
});
