import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";

import { Header } from "@/components/dashboard/header";
import { SimpleChart } from "@/components/monitor-charts/simple-chart";
import { groupDataByTimestamp } from "@/components/monitor-charts/utils";
import { env } from "@/env";
import { quantiles } from "@/lib/monitor/utils";
import { api } from "@/trpc/server";

// Add loading page

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  quantile: z.enum(quantiles).optional().default("p95"),
  period: z.enum(["7d"]).optional().default("7d"),
});

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export default async function Page({
  params,
  searchParams,
}: {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const search = searchParamsSchema.safeParse(searchParams);
  if (!page || !search.success) notFound();

  const { quantile, period } = search.data;

  // filter monitor by public or not

  const publicMonitors = page.monitors.filter((monitor) => monitor.public);

  const monitorsWithData =
    publicMonitors.length > 0
      ? await Promise.all(
          publicMonitors?.map(async (monitor) => {
            const data = await tb.endpointChartAllRegions(period)({
              monitorId: String(monitor.id),
            });

            return { monitor, data };
          }),
        )
      : undefined;

  return (
    <div className="grid gap-8">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      {monitorsWithData ? (
        <div className="grid gap-6">
          <div className="text-muted-foreground">
            <p>
              Response time over the{" "}
              <span className="text-foreground font-medium">last {period}</span>{" "}
              across{" "}
              <span className="text-foreground font-medium">
                all selected regions
              </span>{" "}
              within a{" "}
              <span className="text-foreground font-medium">p95 quantile</span>.
            </p>
            <p>Click a monitor to access more detailed informations.</p>
          </div>
          <ul className="grid gap-6">
            {monitorsWithData?.map(({ monitor, data }) => {
              const group =
                data &&
                groupDataByTimestamp(
                  data.map((data) => ({ ...data, region: "ams" })),
                  period,
                  quantile,
                );
              return (
                <li
                  key={monitor.id}
                  className="hover:bg-accent group -m-2 grid gap-2 rounded-md p-2"
                >
                  <Link href={`./monitors/${monitor.id}`}>
                    <p className="text-sm font-semibold">{monitor.name}</p>
                    {group ? (
                      <SimpleChart data={group.data} region="ams" />
                    ) : (
                      <p>missing data</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-sm font-light">
          No public monitor.
        </p>
      )}
    </div>
  );
}
