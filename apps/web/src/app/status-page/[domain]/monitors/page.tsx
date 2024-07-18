import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui";

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

export const revalidate = 120;

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
          <p className="text-muted-foreground">
            Response time over the{" "}
            <span className="font-medium text-foreground">last {period}</span>{" "}
            across{" "}
            <span className="font-medium text-foreground">
              all selected regions
            </span>{" "}
            within a{" "}
            <span className="font-medium text-foreground">p95 quantile</span>.
          </p>
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
                <li key={monitor.id} className="grid gap-2">
                  <div className="flex w-full min-w-0 items-center justify-between gap-3">
                    <div className="w-full min-w-0">
                      <p className="font-semibold text-sm">{monitor.name}</p>
                      <p className="truncate text-muted-foreground text-sm">
                        {monitor.url}
                      </p>
                    </div>
                    <Button variant="link" size="sm" asChild>
                      <Link href={`./monitors/${monitor.id}`}>
                        Details <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  {group ? (
                    <SimpleChart data={group.data} region="ams" />
                  ) : (
                    <p>missing data</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-center font-light text-muted-foreground text-sm">
          No public monitor.
        </p>
      )}
    </div>
  );
}
