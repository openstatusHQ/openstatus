import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const event = z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);

const RouteData = z.object({
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
    .query(async (opts) => {
      try {
        const data = await opts.ctx.clickhouseClient.query({
          query: `
              select
                event_name,
                quantile(0.75)(value) as median
              from cwv
              where
                dsn = '${opts.ctx.workspace.dsn}'
                and event_name = '${opts.input.event}'
              group by event_name
        `,
          format: "JSONEachRow",
        });
        const result = await data.json();
        const schema = z.array(
          z.object({ event_name: z.string(), median: z.number() }),
        );
        if (!result) {
          return null;
        }
        const d = schema.parse(result);
        return d.length > 0 ? d[0] : null;
      } catch (_e) {
        return null;
      }
    }),

  GetAggregatedPerPage: protectedProcedure.query(async (opts) => {
    const data = await opts.ctx.clickhouseClient.query({
      query: `
      select
        count(*) as total_event,
        href
      from
          cwv
      where
          dsn = '${opts.ctx.workspace.dsn}'
      group by
          href
      order by
          total_event desc
      limit
          20
      `,
      format: "JSONEachRow",
    });
    const result = await data.json();
    const schema = z.array(
      z.object({ href: z.string(), total_event: z.coerce.number() }),
    );
    if (!result) {
      return null;
    }
    const totalRoute = schema.parse(result);

    const allData = [];
    for (const currentRoute of totalRoute) {
      const pageData = await opts.ctx.clickhouseClient.query({
        query: `
        select
          quantile(0.75)(value) as value,
          event_name
        from
            cwv
        where
            dsn = '${opts.ctx.workspace.dsn}'
            and href = '${currentRoute.href}'
        group by
            event_name
        `,
        format: "JSONEachRow",
      });
      const result = await pageData.json();

      if (!result) {
        return null;
      }
      const schema = z.array(
        z.object({ event_name: event, value: z.number() }),
      );
      const d = schema.parse(result);
      const r = d.reduce((acc, curr) => {
        // biome-ignore lint: <explanation>
        acc = {
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          ...acc,
          [`${String(curr.event_name).toLowerCase()}Value`]: curr.value,
        };

        return acc;
      });
      allData.push({
        ...currentRoute,
        ...r,
      });
    }
    // console.log(allData);
    // return;
    return z.array(RouteData).parse(allData);
  }),
});
